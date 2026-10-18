from pathlib import Path
import word_recognition_v3330 as w
root=Path(__file__).resolve().parents[2]
client=(root/'public/valid-word-feedback-v3330.js').read_text(encoding='utf-8')
for word in sorted(w.RECOGNITION_OVERLAY):
 assert word in w.RECOGNITION_OVERLAY
 assert w._recognize_source(word)=='editorial_overlay'
 assert "'"+word+"'" in client
 assert w._recognize_source(word.upper())=='editorial_overlay'
for word in ['qxzq','1234','negr']:
 assert w._recognize_source(word) is None or not w._acceptable(word)
print('PASS: server editorial words match offline client, invalid controls remain rejected')
