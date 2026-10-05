"""Stage-aware entry point: never overwrite a final editorial acceptance on resume."""
from pathlib import Path
import sys
from tools import daily_gen6

def main():
    args=sys.argv[1:]
    if '--out' not in args:
        raise ValueError('An explicit candidate output directory is required')
    out=Path(args[args.index('--out')+1]).resolve()
    if (out/'acceptance-checkpoint.json').exists():
        raise ValueError('This batch has editorial acceptance. Keep its final checkpoint; do not rerun the earlier manufacturing stage into this directory.')
    daily_gen6.main()

if __name__=='__main__':main()
