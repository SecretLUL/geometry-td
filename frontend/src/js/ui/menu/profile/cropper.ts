export class AvatarCropper {
  private avatarContainer: HTMLElement | null = null;
  private avatarInput: HTMLInputElement | null = null;
  private avatarCropModal: HTMLElement | null = null;
  private closeCropModal: HTMLElement | null = null;
  private cancelCropBtn: HTMLElement | null = null;
  private confirmCropBtn: HTMLElement | null = null;
  private cropCanvas: HTMLCanvasElement | null = null;
  private cropZoomSlider: HTMLInputElement | null = null;

  constructor() {
    this.avatarContainer = document.getElementById("profile-avatar-container");
    this.avatarInput = document.getElementById("profile-avatar-input") as HTMLInputElement | null;
    this.avatarCropModal = document.getElementById("avatarCropModal");
    this.closeCropModal = document.getElementById("closeCropModal");
    this.cancelCropBtn = document.getElementById("cancelCropBtn");
    this.confirmCropBtn = document.getElementById("confirmCropBtn");
    this.cropCanvas = document.getElementById("cropCanvas") as HTMLCanvasElement | null;
    this.cropZoomSlider = document.getElementById("cropZoomSlider") as HTMLInputElement | null;
  }

  public init(): void {
    this.avatarContainer?.addEventListener("click", () => {
      this.avatarInput?.click();
    });

    this.avatarInput?.addEventListener("change", () => {
      if (!this.avatarInput || !this.avatarInput.files || this.avatarInput.files.length === 0)
        return;
      const file = this.avatarInput.files[0];
      if (file.size > 2 * 1024 * 1024) {
        alert("Das ausgewählte Bild ist zu groß (maximal 2 MB).");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          this.openCropper(result);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  private openCropper(imgSrc: string): void {
    const modal = this.avatarCropModal;
    const canvas = this.cropCanvas;
    const slider = this.cropZoomSlider;
    if (!modal || !canvas || !slider) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let sourceImg: HTMLImageElement | null = new Image();
    sourceImg.src = imgSrc;
    sourceImg.onload = () => {
      if (!sourceImg) return;
      const imgW = sourceImg.width;
      const imgH = sourceImg.height;

      // Min scale to fully cover 200px crop circle (centered in 300x300 canvas)
      const minScale = Math.max(200 / imgW, 200 / imgH);
      let scale = minScale;
      const maxScale = minScale * 4;

      slider.min = String(minScale);
      slider.max = String(maxScale);
      slider.step = "0.001";
      slider.value = String(scale);

      let offsetX = 0;
      let offsetY = 0;
      let isDragging = false;
      let startX = 0;
      let startY = 0;

      const clampOffsets = () => {
        if (!sourceImg) return;
        const limitX = Math.max(0, (sourceImg.width * scale) / 2 - 100);
        offsetX = Math.max(-limitX, Math.min(limitX, offsetX));

        const limitY = Math.max(0, (sourceImg.height * scale) / 2 - 100);
        offsetY = Math.max(-limitY, Math.min(limitY, offsetY));
      };

      const render = () => {
        if (!sourceImg || !ctx) return;
        ctx.clearRect(0, 0, 300, 300);

        // Draw image
        ctx.save();
        ctx.translate(150 + offsetX, 150 + offsetY);
        ctx.scale(scale, scale);
        ctx.drawImage(sourceImg, -sourceImg.width / 2, -sourceImg.height / 2);
        ctx.restore();

        // Draw circular mask (semi-transparent black overlay outside the circle)
        ctx.save();
        ctx.fillStyle = "rgba(5, 5, 16, 0.65)";
        ctx.beginPath();
        ctx.rect(0, 0, 300, 300);
        ctx.arc(150, 150, 100, 0, Math.PI * 2);
        ctx.fill("evenodd");
        ctx.restore();

        // Draw glowing cyber border
        ctx.save();
        ctx.strokeStyle = "rgba(76, 201, 240, 0.8)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "rgba(76, 201, 240, 0.5)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(150, 150, 100, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };

      const handleMouseDown = (e: MouseEvent) => {
        isDragging = true;
        startX = e.clientX - offsetX;
        startY = e.clientY - offsetY;
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        offsetX = e.clientX - startX;
        offsetY = e.clientY - startY;
        clampOffsets();
        render();
      };

      const handleMouseUp = () => {
        isDragging = false;
      };

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        isDragging = true;
        startX = e.touches[0].clientX - offsetX;
        startY = e.touches[0].clientY - offsetY;
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!isDragging || e.touches.length !== 1) return;
        offsetX = e.touches[0].clientX - startX;
        offsetY = e.touches[0].clientY - startY;
        clampOffsets();
        render();
      };

      const handleTouchEnd = () => {
        isDragging = false;
      };

      const handleSliderInput = () => {
        scale = parseFloat(slider.value);
        clampOffsets();
        render();
      };

      canvas.addEventListener("mousedown", handleMouseDown);
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
      canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
      window.addEventListener("touchend", handleTouchEnd);
      slider.addEventListener("input", handleSliderInput);

      const handleOutsideClick = (e: MouseEvent) => {
        if (e.target === modal) {
          handleCancel();
        }
      };
      modal.addEventListener("click", handleOutsideClick);

      const cleanup = () => {
        canvas.removeEventListener("mousedown", handleMouseDown);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        canvas.removeEventListener("touchstart", handleTouchStart);
        canvas.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);
        slider.removeEventListener("input", handleSliderInput);
        modal.removeEventListener("click", handleOutsideClick);

        if (this.confirmCropBtn) this.confirmCropBtn.onclick = null;
        if (this.cancelCropBtn) this.cancelCropBtn.onclick = null;
        if (this.closeCropModal) this.closeCropModal.onclick = null;

        modal.classList.add("hidden");
        if (this.avatarInput) this.avatarInput.value = "";
        sourceImg = null;
      };

      const handleConfirm = async () => {
        if (!sourceImg) return;

        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = 128;
        exportCanvas.height = 128;
        const exportCtx = exportCanvas.getContext("2d");
        if (exportCtx) {
          exportCtx.save();
          exportCtx.translate(64 + offsetX * 0.64, 64 + offsetY * 0.64);
          exportCtx.scale(scale * 0.64, scale * 0.64);
          exportCtx.drawImage(sourceImg, -sourceImg.width / 2, -sourceImg.height / 2);
          exportCtx.restore();

          const resizedBase64 = exportCanvas.toDataURL("image/jpeg", 0.8);

          try {
            const response = await fetch(`/api/user/profile`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ avatar: resizedBase64 }),
            });
            const result = await response.json();
            if (response.ok && result.success) {
              const avatarDisplay = document.getElementById("profile-avatar-display");
              const topAvatar = document.getElementById("top-profile-avatar");
              if (avatarDisplay) {
                avatarDisplay.replaceChildren();
                const newImg = document.createElement("img");
                newImg.src = resizedBase64;
                newImg.alt = "Profile Picture";
                avatarDisplay.appendChild(newImg);
              }
              if (topAvatar) {
                topAvatar.replaceChildren();
                const newImg = document.createElement("img");
                newImg.src = resizedBase64;
                newImg.alt = "Profile";
                topAvatar.appendChild(newImg);
              }
              cleanup();
            } else {
              alert(result.error || "Fehler beim Hochladen des Profilbildes.");
            }
          } catch (err) {
            console.error("Error uploading avatar:", err);
            alert("Verbindungsfehler beim Hochladen.");
          }
        }
      };

      const handleCancel = () => {
        cleanup();
      };

      if (this.confirmCropBtn) this.confirmCropBtn.onclick = handleConfirm;
      if (this.cancelCropBtn) this.cancelCropBtn.onclick = handleCancel;
      if (this.closeCropModal) this.closeCropModal.onclick = handleCancel;

      render();
      modal.classList.remove("hidden");
    };
  }
}
