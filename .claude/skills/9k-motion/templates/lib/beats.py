# python3 lib/beats.py audio/track.wav > beats.json   (needs: pip install numpy librosa soundfile)
# The animation reads beats.json: state changes on beats, big moments on downbeats, SFX on hits.
import sys, json
import numpy as np, librosa

y, sr = librosa.load(sys.argv[1], sr=None, mono=True)
tempo, frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
beats = librosa.frames_to_time(frames, sr=sr).round(3).tolist()

onset = librosa.onset.onset_strength(y=y, sr=sr)
peaks = librosa.util.peak_pick(onset, pre_max=3, post_max=3, pre_avg=3, post_avg=5, delta=0.5, wait=10)
json.dump({
    "bpm": float(np.atleast_1d(tempo)[0]),
    "duration": round(len(y) / sr, 3),
    "beats": beats,
    "downbeats": beats[::4],
    "hits": librosa.frames_to_time(peaks, sr=sr).round(3).tolist(),
}, sys.stdout, indent=1)
