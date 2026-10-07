"""Snap proposed cut points to the local energy minimum (10 ms RMS frames) within +-window."""
import json, sys, wave, struct, math
wav = sys.argv[1]; win = 0.09
w = wave.open(wav); sr = w.getframerate(); n = w.getnframes()
data = struct.unpack('<%dh' % n, w.readframes(n))
hop = int(sr * 0.01)
rms = [math.sqrt(sum(s*s for s in data[i:i+hop]) / hop) for i in range(0, n - hop, hop)]
def db(v): return 20*math.log10(max(v,1)/32768)
segs = json.load(open(sys.argv[2]))
out = []
for s in segs:
    res = {}
    for k in ('in', 'out'):
        t = s[k]; lo = max(0, int((t - win) * 100)); hi = int((t + win) * 100)
        # bias: in-points must not move later than proposed+win, out-points not earlier
        best = min(range(lo, hi + 1), key=lambda i: rms[i])
        res[k] = round(best / 100, 2); res[k + '_db'] = round(db(rms[best]), 1); res[k + '_orig_db'] = round(db(rms[int(t*100)]), 1)
    out.append({**s, **res})
for o in out:
    print(o['id'], o['in'], o['in_db'], '(was', o['in_orig_db'], ')', o['out'], o['out_db'], '(was', o['out_orig_db'], ')', o['text'][:40])
json.dump(out, open(sys.argv[3], 'w'), ensure_ascii=False, indent=1)
