# LiveKit Infrastructure: Options & Trade-offs

## Why Railway Won't Work for Production

### The Core Problem: UDP

WebRTC requires UDP for peer-to-peer connections and TURN relay traffic. **Railway only exposes TCP/HTTP** — UDP ports cannot be opened.

This causes:
- `ConnectionError: could not establish pc connection` for candidates behind corporate firewalls, VPNs, or strict home routers
- All WebRTC traffic must use TCP fallback (slower, not always available)
- No TURN server can be hosted on Railway (TURN requires UDP port 3478)

### What TURN Is and Why It Matters

TURN (Traversal Using Relays around NAT) is a relay server that acts as a middleman when two WebRTC peers can't connect directly. Without it:

- Candidates on corporate networks: **fail**
- Candidates on VPNs: **fail**
- Candidates behind strict NAT/firewalls: **fail**

In a recruiting context this is a critical reliability gap — a candidate who can't connect simply doesn't get interviewed.

### Railway TCP TURN Workaround — Why It's Still Inadequate

LiveKit's built-in TURN supports TCP/TLS mode (port 5349), which Railway *can* expose. However:
- TCP TURN is higher latency than UDP TURN
- It doesn't solve all NAT traversal scenarios
- Railway's proxy layer adds another hop, increasing instability
- No control over Railway's underlying network infrastructure

**Railway is fundamentally unsuitable for production WebRTC at any scale.**

---

## Infrastructure Options Comparison

| Factor | Railway (current) | LiveKit Cloud | GCP Self-hosted |
|---|---|---|---|
| UDP support | ❌ No | ✅ Global | ✅ Yes |
| TURN/STUN | ❌ Not possible | ✅ Built-in, global | ✅ Full control |
| WebRTC reliability | ❌ Fails for ~20-30% of users | ✅ Excellent | ✅ Excellent |
| Setup effort | Already done | ~30 min (env vars) | ~4-8 hours |
| Ops overhead | Low | None (managed) | Medium-High |
| Auto-scaling | ❌ Manual | ✅ Automatic | ✅ With setup |
| Horizontal clustering | ❌ No | ✅ Yes | ✅ Yes (Redis) |
| Recording egress | Via Supabase S3 | Via Supabase S3 | Via GCS or Supabase |
| Cost: 10 concurrent interviews | ~$15/mo VM | ~$120/mo | ~$30/mo |
| Cost: 100 concurrent interviews | Not viable | ~$5,700/mo | ~$300-500/mo |
| Cost: 500 concurrent interviews | Not viable | ~$28,500/mo | ~$1,500-2,000/mo |

### Cost Calculation Basis

- LiveKit Cloud pricing: ~$2 per 1,000 participant-minutes
- 100 concurrent interviews × 60 min × 2 participants (candidate + agent) = 12,000 participant-minutes/hour
- At 8 peak hours/day: ~$1,920/day → ~$5,700/month

---

## Recommended Migration Path

### Phase 1 — Now (current volume)
**Migrate to LiveKit Cloud**
- Update 4 env vars in Vercel: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`, `NEXT_PUBLIC_LIVEKIT_URL`
- Update 3 env vars in Railway livekit-agent service: same keys
- Remove the self-hosted `livekit-server` Railway service
- Zero code changes required

**Solves**: WebRTC connectivity failures, duplicate agent issues (LiveKit Cloud has better dispatch handling), zero ops overhead.

### Phase 2 — At 50+ Concurrent Interviews Regularly
**Migrate to GCP Self-hosted Cluster**

Architecture:
```
GCP Load Balancer
├── LiveKit Node 1  (e2-standard-4)
├── LiveKit Node 2  (e2-standard-4)
└── LiveKit Node N  (Managed Instance Group — auto-scale)
        ↕
    Redis (Memorystore)   ← cluster coordination
        ↕
  TURN Server Pool        ← coturn or LiveKit built-in, UDP 3478 open
```

Required GCP firewall rules:
- TCP: 443, 7880, 7881
- UDP: 3478 (TURN/STUN), 50000-60000 (WebRTC media)

Cost savings vs LiveKit Cloud at 100 concurrent: **~91% reduction** (~$500/mo vs ~$5,700/mo).

### Migration Note

LiveKit Cloud → GCP is a low-friction migration. Same LiveKit API, same agent code, same frontend SDK. Only env vars change (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`).

---

## Decision Summary

| Current stage | Recommendation |
|---|---|
| < 50 concurrent interviews/day | LiveKit Cloud |
| 50-200 concurrent interviews/day | LiveKit Cloud Enterprise (negotiate pricing) or begin GCP planning |
| 200+ concurrent interviews/day | GCP self-hosted cluster |
