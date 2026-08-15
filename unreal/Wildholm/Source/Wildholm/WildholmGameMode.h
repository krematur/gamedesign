#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "WildholmGameMode.generated.h"

// The authoritative side of the game — the Unreal-native replacement for
// server/game.js + server/index.js. Runs on a dedicated or listen server;
// clients never trust their own local state for anything gameplay-affecting,
// same principle as the old Socket.IO server, just enforced by Unreal's
// actor-authority model (HasAuthority()) instead of a custom protocol.
UCLASS(Blueprintable)
class WILDHOLM_API AWildholmGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AWildholmGameMode();

protected:
	virtual void PostLogin(APlayerController* NewPlayer) override;
};
