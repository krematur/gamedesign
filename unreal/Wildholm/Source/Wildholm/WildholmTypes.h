#pragma once

#include "CoreMinimal.h"
#include "WildholmTypes.generated.h"

// Mirrors server/quality.js: Crude/Normal/Fine gather-quality tiers.
UENUM(BlueprintType)
enum class EWildholmQuality : uint8
{
	Crude	UMETA(DisplayName = "Crude"),
	Normal	UMETA(DisplayName = "Normal"),
	Fine	UMETA(DisplayName = "Fine"),
};

// One inventory stack. ItemId matches the id used in the item DataTable
// (see Content/Data/DT_Items, ported from server/items.js) so gameplay code
// never hardcodes item names.
USTRUCT(BlueprintType)
struct FWildholmInventorySlot
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wildholm")
	FName ItemId;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wildholm")
	int32 Quantity = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wildholm")
	EWildholmQuality Quality = EWildholmQuality::Normal;
};

// One quest's progress for a given player — mirrors the activeQuests map
// server/game.js keeps per player, as a replicable array instead of a map
// (TMap isn't natively net-replicated).
USTRUCT(BlueprintType)
struct FWildholmQuestProgress
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wildholm")
	FName QuestId;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wildholm")
	int32 Progress = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wildholm")
	bool bComplete = false;
};
