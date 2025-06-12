// Sound Generator Utility for Notifications
// Creates different notification sounds programmatically using Web Audio API

export class NotificationSoundGenerator {
  private audioContext: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  // Generate a simple beep tone
  private generateTone(frequency: number, duration: number, volume: number = 0.3): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audioContext) {
        resolve();
        return;
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);

      setTimeout(() => resolve(), duration * 1000);
    });
  }

  // Generate multiple tones in sequence
  private async generateSequence(tones: Array<{ frequency: number; duration: number; volume?: number }>): Promise<void> {
    for (const tone of tones) {
      await this.generateTone(tone.frequency, tone.duration, tone.volume || 0.3);
      await new Promise(resolve => setTimeout(resolve, 50)); // Small gap between tones
    }
  }

  // Success sound - ascending chime
  async playSuccess(): Promise<void> {
    await this.generateSequence([
      { frequency: 523.25, duration: 0.15 }, // C5
      { frequency: 659.25, duration: 0.15 }, // E5
      { frequency: 783.99, duration: 0.25 }  // G5
    ]);
  }

  // Error sound - descending harsh tone
  async playError(): Promise<void> {
    await this.generateSequence([
      { frequency: 400, duration: 0.2, volume: 0.4 },
      { frequency: 300, duration: 0.3, volume: 0.3 }
    ]);
  }

  // Warning sound - alternating tones
  async playWarning(): Promise<void> {
    await this.generateSequence([
      { frequency: 800, duration: 0.15 },
      { frequency: 600, duration: 0.15 },
      { frequency: 800, duration: 0.15 }
    ]);
  }

  // Info sound - gentle single tone
  async playInfo(): Promise<void> {
    await this.generateTone(440, 0.3, 0.2); // A4, soft
  }

  // Job completed sound - celebratory sequence
  async playJobCompleted(): Promise<void> {
    await this.generateSequence([
      { frequency: 523.25, duration: 0.1 }, // C5
      { frequency: 659.25, duration: 0.1 }, // E5
      { frequency: 783.99, duration: 0.1 }, // G5
      { frequency: 1046.5, duration: 0.2 }  // C6
    ]);
  }

  // Low credits sound - urgent but not alarming
  async playLowCredits(): Promise<void> {
    await this.generateSequence([
      { frequency: 659.25, duration: 0.15 }, // E5
      { frequency: 523.25, duration: 0.15 }, // C5
      { frequency: 440, duration: 0.2 }      // A4
    ]);
  }

  // Credit purchase sound - positive chime
  async playCreditPurchase(): Promise<void> {
    await this.generateSequence([
      { frequency: 659.25, duration: 0.1 }, // E5
      { frequency: 783.99, duration: 0.1 }, // G5
      { frequency: 1046.5, duration: 0.15 }, // C6
      { frequency: 1318.5, duration: 0.2 }  // E6
    ]);
  }

  // System update sound - neutral notification
  async playSystemUpdate(): Promise<void> {
    await this.generateSequence([
      { frequency: 523.25, duration: 0.15 }, // C5
      { frequency: 783.99, duration: 0.15 }  // G5
    ]);
  }

  // Play sound based on notification type
  async playNotificationSound(type: string): Promise<void> {
    try {
      switch (type) {
        case 'success':
          await this.playSuccess();
          break;
        case 'error':
          await this.playError();
          break;
        case 'warning':
          await this.playWarning();
          break;
        case 'info':
          await this.playInfo();
          break;
        case 'job_completed':
        case 'batch_complete':
          await this.playJobCompleted();
          break;
        case 'low_credits':
          await this.playLowCredits();
          break;
        case 'credit_purchase':
          await this.playCreditPurchase();
          break;
        case 'system_update':
          await this.playSystemUpdate();
          break;
        default:
          await this.playInfo();
      }
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }
}

// Create a singleton instance
export const notificationSounds = new NotificationSoundGenerator(); 