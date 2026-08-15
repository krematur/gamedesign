#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "WildholmTypes.h"
#include "WildholmCharacter.generated.h"

class UCameraComponent;
class USpringArmComponent;
class UInputMappingContext;
class UInputAction;
struct FInputActionValue;

// Third-person survival character. Health/Hunger/Inventory are server-
// authoritative and replicated to owning clients (and Health to everyone,
// so other players' health bars can be shown) — the same authority model
// as the Node.js server in server/game.js, just implemented as native
// Unreal actor replication instead of Socket.IO snapshots.
UCLASS(Blueprintable)
class WILDHOLM_API AWildholmCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AWildholmCharacter();

	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

protected:
	virtual void BeginPlay() override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

	UPROPERTY(EditDefaultsOnly, Category = "Wildholm|Camera")
	TObjectPtr<USpringArmComponent> CameraBoom;

	UPROPERTY(EditDefaultsOnly, Category = "Wildholm|Camera")
	TObjectPtr<UCameraComponent> FollowCamera;

	UPROPERTY(EditDefaultsOnly, Category = "Wildholm|Input")
	TObjectPtr<UInputMappingContext> DefaultMappingContext;

	UPROPERTY(EditDefaultsOnly, Category = "Wildholm|Input")
	TObjectPtr<UInputAction> MoveAction;

	UPROPERTY(EditDefaultsOnly, Category = "Wildholm|Input")
	TObjectPtr<UInputAction> LookAction;

	UPROPERTY(EditDefaultsOnly, Category = "Wildholm|Input")
	TObjectPtr<UInputAction> InteractAction;

	void Move(const FInputActionValue& Value);
	void Look(const FInputActionValue& Value);
	void Interact(const FInputActionValue& Value);

public:
	// ---- Survival stats (server-authoritative) ----
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Wildholm|Stats")
	float MaxHealth = 100.f;

	UPROPERTY(ReplicatedUsing = OnRep_Health, BlueprintReadOnly, Category = "Wildholm|Stats")
	float Health = 100.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Wildholm|Stats")
	float MaxHunger = 100.f;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Wildholm|Stats")
	float Hunger = 100.f;

	// Only the owning client needs to see their own inventory contents.
	UPROPERTY(ReplicatedUsing = OnRep_Inventory, BlueprintReadOnly, Category = "Wildholm|Inventory")
	TArray<FWildholmInventorySlot> Inventory;

	UPROPERTY(ReplicatedUsing = OnRep_Quests, BlueprintReadOnly, Category = "Wildholm|Quests")
	TArray<FWildholmQuestProgress> ActiveQuests;

	UFUNCTION(BlueprintCallable, Category = "Wildholm|Stats")
	void ApplyDamage(float Amount);

	UFUNCTION(BlueprintCallable, Category = "Wildholm|Stats")
	bool IsAlive() const { return Health > 0.f; }

	UFUNCTION(Server, Reliable, BlueprintCallable, Category = "Wildholm|Gather")
	void ServerGather(AActor* ResourceNode);

	UFUNCTION(BlueprintImplementableEvent, Category = "Wildholm|Stats")
	void OnHealthChanged(float NewHealth, float OldHealth);

	UFUNCTION(BlueprintImplementableEvent, Category = "Wildholm|Inventory")
	void OnInventoryChanged();

private:
	UFUNCTION()
	void OnRep_Health(float OldHealth);

	UFUNCTION()
	void OnRep_Inventory();

	UFUNCTION()
	void OnRep_Quests();
};
