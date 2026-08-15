#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameStateBase.h"
#include "WildholmGameState.generated.h"

// Shared world state every client needs, replicated automatically to all
// connected players — the Unreal equivalent of the `dayPhase`/`isNight`
// fields server/game.js used to include in every network snapshot.
UCLASS(Blueprintable)
class WILDHOLM_API AWildholmGameState : public AGameStateBase
{
	GENERATED_BODY()

public:
	AWildholmGameState();

	virtual void Tick(float DeltaSeconds) override;
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	// [0,1) fraction through the current day; wraps back to 0 at dusk->dawn.
	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Wildholm|Time")
	float DayPhase = 0.f;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Wildholm|Time")
	bool bIsNight = false;

	// Real-world seconds for one full day/night cycle. server/game.js used
	// DAY_LENGTH_TICKS * TICK_MS (150ms ticks) — pick whatever fits
	// playtesting once this is running; 600s (10 min) is a reasonable start.
	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Wildholm|Time")
	float DayLengthSeconds = 600.f;

private:
	// Mirrors the nightDarkness() phase windows in public/js/render3d.js —
	// night runs from phase 0.55 to 0.97, plus dusk/dawn transitions.
	static bool ComputeIsNight(float Phase);
};
