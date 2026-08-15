# Setting up the Unreal Engine 5 port locally

Everything in `Source/` and `Config/` here was hand-authored in a sandboxed
environment with **no GUI, no Unreal Engine installed, and no network
access to download it** — so none of it has been opened or compiled yet.
This doc is the checklist to actually get it running.

## 1. Install prerequisites

- **Epic Games account** — sign up at epicgames.com if you don't have one;
  it's how Unreal Engine is licensed and distributed.
- **Epic Games Launcher** — install it, then use it to install
  **Unreal Engine 5.3+** (match `EngineAssociation` in `Wildholm.uproject`
  if you use a different 5.x version — just edit that field). This is a
  large download, roughly 30–100GB depending on which engine feature
  packs you select, so make sure you have the disk space and time for it.
- **C++ toolchain** (Unreal needs a real compiler, separate from the
  engine itself):
  - Windows: Visual Studio 2022, "Game development with C++" workload
  - Mac: Xcode
  - Linux: clang + the Unreal Linux toolchain (less common, more manual
    setup — see Epic's Linux docs)

## 2. Get the project

Clone this repo (or pull the current branch) onto the machine where you
just installed the above. You want `unreal/Wildholm/` on disk somewhere
UE5 can see it — it doesn't need to be the repo root, `unreal/Wildholm/`
is a self-contained `.uproject` directory.

## 3. First open / first compile

1. Right-click `Wildholm.uproject` → "Generate Visual Studio project
   files" (Windows), or just open it directly (Mac/Linux).
2. Open the project. The Editor will notice the `Wildholm` C++ module
   isn't built and offer to compile it — accept.
3. **Expect compile errors on this first pass.** This code was written
   without ever being checked by a compiler — no engine was available to
   validate it against. Likely failure modes, roughly in order of
   probability:
   - A header include that moved between engine versions (Epic
     reorganizes these somewhat often)
   - An Enhanced Input API detail (it's had a couple of minor signature
     changes across 5.x releases)
   - A replication macro used slightly wrong (`DOREPLIFETIME_CONDITION`
     argument order, etc.)
   These should all be small, mechanical fixes — the actual game-logic
   structure (what's replicated, what's server-authoritative, the overall
   class layout) was designed carefully even without being testable.
4. Once it compiles: create `Content/Maps/L_Wildholm` (or point
   `Config/DefaultEngine.ini`'s `GameDefaultMap`/`EditorStartupMap` at
   whatever you name it instead) and confirm `AWildholmCharacter` spawns
   and moves around on an empty level. That's the first real milestone —
   everything up to here is just "does the scaffold work at all."

## 4. From there

Work through `DESIGN_PORT.md` — it maps every remaining system (world/
landscape, items, quests, mobs, resource fields, UI, equipment) from the
browser version to what it becomes in UE5, and flags which parts need the
Editor GUI (most of the content) versus which are C++ (most of the
gameplay logic).

## Working with Claude Code locally instead of (or alongside) this session

This sandboxed session can't reach your machine, drive the Unreal Editor,
or compile anything UE5-related — that's a hard constraint of the
environment it runs in, not something that improves with more time here.

If you run **Claude Code locally**, in this same repo, on the machine
where you've installed UE5, that session *does* have the real compiler
and real engine — it can build the project, read actual error output, and
fix issues directly instead of guessing blind. That's the effective way
to get UE5-side help going forward: do the engine-dependent work with a
local Claude Code session (or by hand), commit and push, and any
cloud-based session (like this one) can continue from whatever lands on
the branch — world-gen/export tooling, design docs, data mapping, and
anything else that doesn't require the engine itself.
