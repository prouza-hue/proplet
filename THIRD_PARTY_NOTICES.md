# Third-party recognition data

## Czech Hunspell bonus-word dictionary

The separate bonus-word recognition dataset under `data/recognition/` and
`public/recognition/` is derived from the Czech Hunspell dictionary in
[LibreOffice/dictionaries](https://github.com/LibreOffice/dictionaries/tree/b3a1c0be50d1ad0b404070124463fb4af90bbe39/cs_CZ),
commit `b3a1c0be50d1ad0b404070124463fb4af90bbe39`.

The original Czech ispell dictionary was created by Petr Kolář and numerous
contributors. The 2021 update was made by Miroslav Pošta. The upstream notices
describe the spelling dictionary as GNU GPL; the Czech notice includes the full
GNU General Public License version 2. The compiled derivative and transformation
are provided under GPL version 2.

The original `.dic`, `.aff`, notices, full license, source checksums and exact
transformation are preserved under `content/recognition/` and
`tools/build_bonus_recognition.py`. The corresponding source is also available
from the same public site at
[/recognition/bonus-cs-v1-source.zip](/recognition/bonus-cs-v1-source.zip).

See [content/recognition/README.md](content/recognition/README.md) for the
recognition policy, format, reproducible build and changes to the source data.
