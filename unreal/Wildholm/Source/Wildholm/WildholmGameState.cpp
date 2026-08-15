#include "WildholmGameState.h"

#include "Net/UnrealNetwork.h"

AWildholmGameState::AWildholmGameState()
{
	PrimaryActorTick.bCanEverTick = true;
}

void AWildholmGameState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(AWildholmGameState, DayPhase);
	DOREPLIFETIME(AWildholmGameState, bIsNight);
}

void AWildholmGameState::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!HasAuthority() || DayLengthSeconds <= 0.f) return;

	DayPhase = FMath::Fmod(DayPhase + DeltaSeconds / DayLengthSeconds, 1.f);
	bIsNight = ComputeIsNight(DayPhase);
}

bool AWildholmGameState::ComputeIsNight(float Phase)
{
	return Phase > 0.55f && Phase < 0.97f;
}
