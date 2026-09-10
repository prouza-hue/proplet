# Preview discovery recognition regression

Input controller captured submitPath before the asynchronously loaded recognition wrapper could replace it. Resolve submitPath at gesture completion instead. This preserves the existing submission and reward rules.

STOP and KVĚT were already in the offline seed. Added RÁMUS to this recognition-only seed, also consumed by server recognition. No generation lexicon or XP limits changed. Versioned seed and shell/module URLs invalidate stale caches.

Verified real stored board paths:
- g4-x-121 RÁMUS: 41,42,32,33,23
- g4-x-121 KVĚT: 46,47,57,58
- g4-m-017 STOP: 13,21,29,28
All are non-solution words.

Node integration uses the actual app input factory and recognition module, tests both initialization orders, guest credit, signed-in claim payload and simulated server confirmation, plus duplicate prevention. Reinstating the original captured callback fails STOP in the early-initialization case. This does not constitute a live account credit audit. Magnifier lifecycle test also passes.
