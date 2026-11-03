"""Fail closed on external Python socket operations; local fixtures remain usable.

This is an accident-prevention guard for trusted tests, not hostile-code isolation.
Native libraries that bypass Python sockets require their own mocked transport.
"""
from __future__ import annotations
import ipaddress
import os
from pathlib import Path
import socket
import subprocess
import sys

_INSTALLED = False

def local_host(host):
    if host is None:
        return True  # getaddrinfo(None) is used to bind local fixture servers.
    if isinstance(host, bytes):
        host = host.decode('ascii', errors='replace')
    if str(host).lower() in ('localhost', 'localhost.'):
        return True
    try:
        address = ipaddress.ip_address(str(host).split('%')[0])
        return address.is_loopback or bool(getattr(address, 'ipv4_mapped', None) and address.ipv4_mapped.is_loopback)
    except ValueError:
        return False

def _deny(host):
    if not local_host(host):
        raise PermissionError('Current test gate blocks external network; use mocked transport or an explicit live-smoke tool.')

def _audit(event, args):
    if event in ('socket.connect', 'socket.sendto'):
        sock, address = args[0], args[-1]
        if sock.family in (socket.AF_INET, socket.AF_INET6):
            _deny(address[0])
    elif event in ('socket.getaddrinfo', 'socket.gethostbyname', 'socket.gethostbyaddr'):
        _deny(args[0])


def _child_command(command, guard):
    """-I/-E ignore PYTHONPATH and -S skips sitecustomize; preserve their semantics."""
    if not isinstance(command, (list, tuple)) or not command:
        return command
    if not Path(str(command[0])).name.lower().startswith(('python', 'pypy')):
        return command
    args = list(command)
    if not any(flag in args[1:] for flag in ('-I', '-E', '-S')):
        return command
    index = 1
    while index < len(args) and args[index].startswith('-') and args[index] not in ('-c', '-m', '-'):
        index += 1
    if index >= len(args):
        return command
    prefix = 'import runpy;runpy.run_path(' + repr(str(guard)) + ',run_name="__test_guard__");'
    if args[index] == '-c':
        args[index + 1] = prefix + args[index + 1]
        return args
    if args[index] == '-m':
        target = args[index + 1]
        return args[:index] + ['-c', prefix + 'import sys;sys.argv=sys.argv[1:];runpy.run_module(' + repr(target) + ',run_name="__main__",alter_sys=True)', target] + args[index + 2:]
    target = args[index]
    return args[:index] + ['-c', prefix + 'import sys;sys.argv=sys.argv[1:];runpy.run_path(sys.argv[0],run_name="__main__")', target] + args[index + 1:]


def install():
    global _INSTALLED
    if _INSTALLED:
        return
    _INSTALLED = True
    sys.addaudithook(_audit)
    original = subprocess.Popen.__init__
    guard = Path(__file__).resolve()
    # Preserve guards even when a trusted test replaces its child's environment.
    # Explicit fixture settings (e.g. synthetic VERCEL_ENV) are left untouched.
    required = {key: os.environ[key] for key in ('PROPLET_TEST_ISOLATED', 'NODE_OPTIONS', 'PYTHONPATH') if key in os.environ}
    def isolated_popen(self, args, *positional, **kwargs):
        if kwargs.get('env') is not None:
            kwargs['env'] = {**kwargs['env'], **required}
        return original(self, _child_command(args, guard), *positional, **kwargs)
    subprocess.Popen.__init__ = isolated_popen

if __name__ == '__test_guard__':
    install()
