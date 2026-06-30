# Free Spins / Bonus Audio Design

The goal is to create a cinematic audio experience that builds anticipation and delivers a satisfying payoff when entering Free Spins.

---

# Trigger Conditions

There are two ways to enter Free Spins:

1. **Base Game**
   - Player lands **3 or more Bonus (Scatter) symbols** naturally.

2. **Buy Bonus**
   - Player purchases the Bonus feature.
   - The spin is guaranteed to trigger Free Spins.

---

# Natural Trigger (Base Game)

## Anticipation Mode

Once **2 Bonus symbols** have landed and another reel can still complete the trigger, enter **Anticipation Mode**.

Example:

```text
Reel 1   ✅ Bonus
Reel 2   ✅ Bonus
Reel 3   ?
Reel 4
Reel 5
```

As soon as the second Bonus lands:

---

## Level 1 - Music Transition

Do **not** stop the background music.

Instead:

- Crossfade the current music down to approximately **35% volume**.
- Fade in a cinematic suspense layer.

Audio:

```
Low Brass
↓

"BWOOOOOM"
```

The transition should take approximately **300ms**.

---

## Level 2 - Heartbeat / Tension Layer

Introduce a subtle rhythmic pulse synchronized with the spinning reel.

Instead of a literal heartbeat, use:

- Large drum
- Timpani
- Deep percussion

Pattern:

```
Boom...

Boom...

Boom...

Boom...
```

Each beat becomes slightly stronger as the reel continues spinning.

---

## Level 3 - Reel Spin Audio

Enhance the anticipation reel with layered mechanical sounds.

Normal Reel:

```
rrrrrrrrrrrr
```

Anticipation Reel:

```
Reel Spin
+
Metal Bearing
+
Air Movement
+
Low Rumble
```

As the reel slows:

```
rrrrrrrr

↓

rrrrrr

↓

rrrr

↓

rr

↓

tick

↓

tick

↓

STOP
```

The slowdown should sound heavy and deliberate.

---

## Level 4 - Gold Glow

Every pulse of the reel outline should have a subtle "air whoosh."

```
whoosh

↓

whoosh

↓

whoosh
```

Very soft.

Almost subconscious.

---

## Level 5 - Near Miss

If the Bonus symbol passes the payline before stopping:

Play a quick rising tonal sweep.

```
whooooop
```

Pitch:

```
C

↓

E

↓

G
```

Duration:

Approximately **200ms**.

This should create excitement without overpowering the soundtrack.

---

## Level 6 - Bonus Symbol Landing

When the Bonus lands successfully, layer three sounds together.

### Layer 1 - Heavy Impact

```
THUNK
```

A satisfying mechanical impact.

---

### Layer 2 - Gold Shimmer

```
chinggggg
```

Bright metallic sparkle.

---

### Layer 3 - Choir Accent

```
Ahhhhh
```

Very short.

Approximately **300ms**.

---

## Level 7 - Shockwave

Immediately after the Bonus lands:

Play a deep cinematic bass hit.

```
BOOOOM
```

Not excessively loud.

Wide and cinematic.

---

## Level 8 - Bloom

As the bloom animation plays:

Add light magical sparkle sounds.

```
ting

ting

ting
```

Very subtle.

---

## Level 9 - Free Spins Reveal

After a short pause:

Return to full-volume music.

Layer in:

- Full orchestra
- Brass
- Choir
- Snare drums
- Crowd cheering

Optional additions for the Derby theme:

- Horse galloping
- Victory trumpets
- Stadium crowd roar

Finally:

```
FREE SPINS
```

Voice Over:

```
"FREE SPINS!"
```

---

# Buy Bonus Audio

The Buy Bonus flow should **not** build suspense.

The player already knows they are entering Free Spins.

Instead:

Button Press

```
Coin

↓

Magic Sweep

↓

Immediate Orchestral Rise
```

Skip the long anticipation and transition directly into the celebration sequence.

---

# Audio Mixing

Avoid abrupt audio changes.

Always crossfade.

Example:

Base Music

```
████████████

↓

██████

↓

██

↓

0
```

Suspense Layer

```
0

↓

██

↓

██████

↓

██████████
```

This creates a smooth cinematic transition rather than an obvious audio cut.

---

# Audio Timeline

```
Normal Spin
    │
    ▼
2nd Bonus Lands
    ├─ Music ducks to ~35%
    ├─ Low brass swell begins
    ├─ Heartbeat/timpani pulse starts
    └─ Crowd ambience subtly increases
            │
            ▼
Anticipation Reel Spins
    ├─ Extended reel spin audio
    ├─ Metallic slowdown
    ├─ Soft whoosh synced to reel glow
    └─ Rising tonal sweep for near miss
            │
            ▼
Bonus Lands
    ├─ Heavy impact
    ├─ Gold shimmer
    ├─ Choir accent
    ├─ Deep bass shockwave
    └─ Crowd erupts
            │
            ▼
FREE SPINS
    ├─ Full orchestra
    ├─ Horse gallop
    ├─ Victory trumpets
    ├─ Crowd celebration
    └─ Voice-over: "FREE SPINS!"
```

---

# Design Principles

- Build anticipation gradually.
- Layer sounds instead of replacing them.
- Crossfade all transitions.
- Keep effects synchronized with reel motion.
- Celebrate the reward with a distinct audio payoff.
- For Buy Bonus, prioritize excitement over suspense since the outcome is already guaranteed.
