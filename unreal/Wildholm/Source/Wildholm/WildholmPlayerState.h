#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerState.h"
#include "WildholmPlayerState.generated.h"

// Survives across pawn respawns (unlike data stored on the Character) —
// this is where the player's display name lives; AWildholmCharacter owns
// the per-life stats (health/hunger/inventory).
UCLASS(Blueprintable)
class WILDHOLM_API AWildholmPlayerState : public APlayerState
{
	GENERATED_BODY()
};
