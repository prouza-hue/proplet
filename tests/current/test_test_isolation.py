"""The ordinary gate cannot inherit live configuration or contact remote sockets."""
from pathlib import Path
import os
import contextlib
import io
from unittest.mock import patch
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from test_environment import isolated_environment
import test_current

class IsolationTests(unittest.TestCase):
    def run_child(self, runner, code, env=None):
        result = subprocess.run([runner, '-c' if runner == sys.executable else '-e', code],
                                cwd=ROOT, env=env or isolated_environment(ROOT),
                                capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout

    def test_focused_selection_requires_exact_registered_paths(self):
        tests = [{"path": "tests/current/a.py", "runner": "python"},
                 {"path": "tests/current/b.cjs", "runner": "node"}]
        self.assertIs(test_current._select_tests(tests, None), tests)
        self.assertEqual(test_current._select_tests(tests, [tests[1]["path"], tests[1]["path"]]), [tests[1]])
        for requested in (["tests/current/*.py"], ["../a.py"], ["tests/current/unknown.py"]):
            with self.assertRaises(ValueError):
                test_current._select_tests(tests, requested)

    def test_focused_cli_still_passes_guarded_environment(self):
        registered = "tests/current/test_test_isolation.py"
        with patch.object(test_current, "_run", return_value=True) as run, \
             patch.object(test_current, "_asset_checks", return_value=(0, 0)) as assets, \
             patch.object(test_current, "_syntax_checks", return_value=(0, 0)) as syntax, \
             contextlib.redirect_stdout(io.StringIO()):
            # A tiny in-memory manifest avoids depending on registration order.
            manifest = {"schema_version": 1, "current": {"tests": [{"path": registered, "runner": "python"}]}}
            with patch.object(test_current.json, "loads", return_value=manifest):
                self.assertEqual(test_current.main(["--only", registered, registered]), 0)
                self.assertEqual(run.call_count, 1)
                env = run.call_args.args[3]
                self.assertEqual(env["PROPLET_TEST_ISOLATED"], "1")
                self.assertIn("node_guard.cjs", env["NODE_OPTIONS"])
                assets.assert_not_called()
                syntax.assert_not_called()
                run.reset_mock()
                self.assertEqual(test_current.main(["--only", "unregistered.py"]), 2)
                run.assert_not_called()
                self.assertEqual(test_current.main([]), 0)
                assets.assert_called_once()
                syntax.assert_called_once()

    def test_allowlist_keeps_runtime_and_only_explicit_local_pg(self):
        source = {'PATH': '/bin', 'HOME': '/home/test', 'NODE_PATH': '/packages',
                  'PYTHONPATH': '/python-packages', 'SUPABASE_SECRET_KEY': 'secret',
                  'POSTGRES_URL': 'postgres://remote/production', 'PGHOST': 'remote.example',
                  'PGPASSWORD': 'password', 'PGSERVICE': 'production', 'PGPASSFILE': '/secrets',
                  'PROPLET_MONTHLY_ENABLED': 'true', 'VERCEL_ENV': 'production',
                  'VERCEL_TOKEN': 'secret', 'AWS_ACCESS_KEY_ID': 'secret', 'GITHUB_TOKEN': 'secret',
                  'SMTP_PASSWORD': 'secret', 'HTTPS_PROXY': 'http://proxy', 'NODE_OPTIONS': '--require /unsafe.cjs'}
        env = isolated_environment(ROOT, source)
        self.assertEqual(env['PATH'], '/bin')
        self.assertEqual(env['HOME'], '/home/test')
        self.assertEqual(env['NODE_PATH'], '/packages')
        self.assertTrue(env['PYTHONPATH'].endswith('/python-packages'))
        for key in source.keys() - {'PATH', 'HOME', 'NODE_PATH', 'PYTHONPATH', 'NODE_OPTIONS'}:
            self.assertNotIn(key, env)
        self.assertNotIn('unsafe', env['NODE_OPTIONS'])
        self.assertEqual(source['SUPABASE_SECRET_KEY'], 'secret', 'caller environment is not mutated')
        local = isolated_environment(ROOT, {**source, 'PGHOST': '127.0.0.1', 'PGPORT': '54399'})
        self.assertEqual(local['PGPORT'], '54399')
        self.assertEqual(local['PGPASSWORD'], 'password')
        self.assertNotIn('PGSERVICE', local)

    def test_python_network_and_children(self):
        self.run_child(sys.executable, r'''
import os,socket,subprocess,sys,threading
import network_guard
assert network_guard._INSTALLED
for action in [lambda: socket.getaddrinfo('offline-test.invalid',443),
               lambda: socket.socket().connect(('192.0.2.1',443)),
               lambda: socket.socket().connect_ex(('192.0.2.1',443)),
               lambda: socket.socket(socket.AF_INET,socket.SOCK_DGRAM).sendto(b'x',('192.0.2.1',443))]:
    try: action()
    except PermissionError: pass
    else: raise AssertionError('external socket was not denied')
server=socket.socket();server.bind(('127.0.0.1',0));server.listen(1)
def receive():
    peer,_=server.accept();peer.sendall(b'ok');peer.close()
thread=threading.Thread(target=receive);thread.start()
with socket.create_connection(('localhost',server.getsockname()[1]),timeout=2) as peer: assert peer.recv(2)==b'ok'
thread.join();server.close()
code="import socket;\ntry: socket.getaddrinfo('offline-test.invalid',443)\nexcept PermissionError: print('DENIED')\nelse: raise AssertionError('child guard missing')"
for flags in [[],['-I'],['-S']]:
    result=subprocess.run([sys.executable,*flags,'-c',code],env={'PATH':os.environ['PATH'],'VERCEL_ENV':'synthetic-build'},capture_output=True,text=True)
    assert result.returncode==0 and 'DENIED' in result.stdout,(flags,result.stderr)
''')

    def test_node_network_and_children(self):
        self.run_child('node', r'''
const assert=require('node:assert/strict'),net=require('node:net'),dns=require('node:dns'),dgram=require('node:dgram'),child=require('node:child_process');
assert(globalThis[Symbol.for('proplet.current-test-network-guard')]);
assert.throws(()=>net.connect({host:'192.0.2.1',port:443}),{code:'ERR_TEST_EXTERNAL_NETWORK'});
assert.throws(()=>require('node:tls').connect({host:'offline-test.invalid',port:443}),{code:'ERR_TEST_EXTERNAL_NETWORK'});
const udp=dgram.createSocket('udp4');assert.throws(()=>udp.send(Buffer.from('x'),443,'192.0.2.1'),{code:'ERR_TEST_EXTERNAL_NETWORK'});udp.close();
(async()=>{
 await assert.rejects(dns.promises.lookup('offline-test.invalid'),{code:'ERR_TEST_EXTERNAL_NETWORK'});
 await assert.rejects(fetch('https://offline-test.invalid/'));
 const server=net.createServer(socket=>socket.end('ok'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const text=await new Promise((resolve,reject)=>{let data='';const socket=net.connect(server.address().port,'localhost');socket.on('data',d=>data+=d);socket.on('error',reject);socket.on('end',()=>resolve(data));});assert.equal(text,'ok');await new Promise(r=>server.close(r));
 const code="const assert=require('assert');assert.throws(()=>require('net').connect({host:'192.0.2.1',port:443}),{code:'ERR_TEST_EXTERNAL_NETWORK'});console.log('DENIED')";
 assert(child.execFileSync(process.execPath,['-e',code],{env:{PATH:process.env.PATH,VERCEL_ENV:'synthetic-build'},encoding:'utf8'}).includes('DENIED'));
})().catch(error=>{console.error(error);process.exitCode=1});
''')

if __name__ == '__main__':
    unittest.main()
