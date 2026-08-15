#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "WildholmPlayerController.generated.h"

UCLASS(Blueprintable)
class WILDHOLM_API AWildholmPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	// Client-side UI hookup (HUD widget class, crafting menu, etc.) goes
	// here once those widgets exist — the Unreal equivalent of client.js's
	// DOM manipulation, but that part has to be built in the Unreal Editor
	// (UMG widgets aren't hand-authorable as plain text the way .gd/.tscn
	// files are, unlike the Godot alternative).
};
