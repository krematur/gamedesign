#include "WildholmCharacter.h"

#include "Camera/CameraComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputActionValue.h"
#include "Net/UnrealNetwork.h"

AWildholmCharacter::AWildholmCharacter()
{
	PrimaryActorTick.bCanEverTick = true;
	bReplicates = true;

	// Third-person camera boom, matching the CAMERA_BACK/CAMERA_HEIGHT
	// follow-camera setup from public/js/render3d.js.
	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->TargetArmLength = 850.f; // Unreal units (cm) ~= 8.5m, matching CAMERA_BACK
	CameraBoom->bUsePawnControlRotation = true;

	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;

	bUseControllerRotationYaw = false;
	GetCharacterMovement()->bOrientRotationToMovement = true;
}

void AWildholmCharacter::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	// Health is visible to everyone (other players' HP bars); hunger and
	// inventory/quests only need to reach the owning client.
	DOREPLIFETIME(AWildholmCharacter, Health);
	DOREPLIFETIME_CONDITION(AWildholmCharacter, Hunger, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(AWildholmCharacter, Inventory, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(AWildholmCharacter, ActiveQuests, COND_OwnerOnly);
}

void AWildholmCharacter::BeginPlay()
{
	Super::BeginPlay();

	if (APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
				ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		{
			if (DefaultMappingContext)
			{
				Subsystem->AddMappingContext(DefaultMappingContext, 0);
			}
		}
	}
}

void AWildholmCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	if (UEnhancedInputComponent* EnhancedInput = Cast<UEnhancedInputComponent>(PlayerInputComponent))
	{
		if (MoveAction)
		{
			EnhancedInput->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AWildholmCharacter::Move);
		}
		if (LookAction)
		{
			EnhancedInput->BindAction(LookAction, ETriggerEvent::Triggered, this, &AWildholmCharacter::Look);
		}
		if (InteractAction)
		{
			EnhancedInput->BindAction(InteractAction, ETriggerEvent::Started, this, &AWildholmCharacter::Interact);
		}
	}
}

void AWildholmCharacter::Move(const FInputActionValue& Value)
{
	const FVector2D MoveVector = Value.Get<FVector2D>();
	if (!Controller) return;

	const FRotator YawRotation(0.f, Controller->GetControlRotation().Yaw, 0.f);
	const FVector Forward = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
	const FVector Right = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);

	AddMovementInput(Forward, MoveVector.Y);
	AddMovementInput(Right, MoveVector.X);
}

void AWildholmCharacter::Look(const FInputActionValue& Value)
{
	const FVector2D LookVector = Value.Get<FVector2D>();
	if (!Controller) return;

	AddControllerYawInput(LookVector.X);
	AddControllerPitchInput(LookVector.Y);
}

void AWildholmCharacter::Interact(const FInputActionValue& Value)
{
	// TODO: raycast for the nearest resource node / NPC and call
	// ServerGather or open the quest dialogue, mirroring client.js's
	// click-to-gather / talk-to-NPC handlers.
}

void AWildholmCharacter::ApplyDamage(float Amount)
{
	if (!HasAuthority() || !IsAlive()) return;

	const float Old = Health;
	Health = FMath::Clamp(Health - Amount, 0.f, MaxHealth);
	OnRep_Health(Old); // server doesn't get OnRep for its own change; call it explicitly
}

void AWildholmCharacter::ServerGather_Implementation(AActor* ResourceNode)
{
	// TODO: port server/game.js gather() — validate range, roll quality via
	// rollGatherQuality (see server/quality.js), add the item to Inventory,
	// deplete the node. Left as a stub since the resource-node actor class
	// and item DataTable are authored in the Unreal Editor, not here.
}

void AWildholmCharacter::OnRep_Health(float OldHealth)
{
	OnHealthChanged(Health, OldHealth);
}

void AWildholmCharacter::OnRep_Inventory()
{
	OnInventoryChanged();
}

void AWildholmCharacter::OnRep_Quests()
{
}
