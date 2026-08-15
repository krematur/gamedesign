#include "WildholmGameMode.h"

#include "WildholmCharacter.h"
#include "WildholmGameState.h"
#include "WildholmPlayerController.h"
#include "WildholmPlayerState.h"

AWildholmGameMode::AWildholmGameMode()
{
	DefaultPawnClass = AWildholmCharacter::StaticClass();
	PlayerControllerClass = AWildholmPlayerController::StaticClass();
	PlayerStateClass = AWildholmPlayerState::StaticClass();
	GameStateClass = AWildholmGameState::StaticClass();
}

void AWildholmGameMode::PostLogin(APlayerController* NewPlayer)
{
	Super::PostLogin(NewPlayer);

	// TODO: port addPlayer()'s spawn-point search from server/game.js
	// (jitter around the world center, retry until walkable) once the
	// island level and its NavMesh/landscape exist in the Unreal Editor.
}
