import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Play, Plus, Volume2, VolumeX } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import soundtrackUrl from '../../../../../bgm/Feiertag - Trepidation feat. Msafiri Zawose (FIFA 22 Soundtrack).mp3?url';

type PlaybackStatus = 'starting' | 'blocked' | 'playing' | 'error';

const buttonClassName =
  'inline-flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary';

export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playRequestRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [volume, setVolume] = useState(25);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('starting');
  const [analysisReady, setAnalysisReady] = useState(false);
  const isEffectivelyMuted = isMuted || volume === 0;

  const startAudioAnalysis = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || analyserRef.current || typeof window.AudioContext === 'undefined') return;

    try {
      const context = new window.AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      context.createMediaElementSource(audio).connect(analyser);
      analyser.connect(context.destination);
      audioContextRef.current = context;
      analyserRef.current = analyser;
      setAnalysisReady(true);
      void context.resume().catch((error: unknown) => {
        console.error('Unable to resume music analysis.', error);
      });
    } catch (error) {
      console.error('Unable to initialize music-reactive visuals.', error);
    }
  }, []);

  const tryStartPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.paused || playRequestRef.current) return;

    playRequestRef.current = true;
    void audio.play().then(
      () => {
        playRequestRef.current = false;
        setPlaybackStatus('playing');
      },
      (error: unknown) => {
        playRequestRef.current = false;
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setPlaybackStatus('blocked');
          return;
        }

        console.error('Unable to play the background soundtrack.', error);
        setPlaybackStatus('error');
      },
    );
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume / 100;
      audio.muted = isMuted;
    }
  }, [isMuted, volume]);

  useEffect(() => {
    const onUserInteraction = () => {
      startAudioAnalysis();
      tryStartPlayback();
    };

    window.addEventListener('pointerdown', onUserInteraction);
    window.addEventListener('keydown', onUserInteraction);
    tryStartPlayback();

    return () => {
      window.removeEventListener('pointerdown', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      document.documentElement.removeAttribute('data-music-active');
      document.documentElement.style.removeProperty('--music-energy');
      void audioContextRef.current?.close();
    };
  }, [startAudioAnalysis, tryStartPlayback]);

  useEffect(() => {
    const root = document.documentElement;
    const isMusicActive = playbackStatus === 'playing' && !isEffectivelyMuted;
    root.dataset.musicActive = String(isMusicActive);

    if (!isMusicActive || !analyserRef.current) {
      root.style.setProperty('--music-energy', '0');
      return;
    }

    const analyser = analyserRef.current;
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    let smoothedEnergy = 0;
    let lastUpdate = 0;

    const updateEnergy = (time: number) => {
      if (time - lastUpdate >= 40) {
        analyser.getByteFrequencyData(frequencyData);
        const bassAndLowMids = frequencyData.slice(1, 18);
        const averageLevel =
          bassAndLowMids.reduce((sum, level) => sum + level, 0) / bassAndLowMids.length;
        const energy = isEffectivelyMuted ? 0 : Math.min(1, (averageLevel / 255) * 2.2);
        smoothedEnergy = smoothedEnergy * 0.68 + energy * 0.32;
        root.style.setProperty('--music-energy', smoothedEnergy.toFixed(3));
        root.style.setProperty('--music-glow-blur', `${(smoothedEnergy * 12).toFixed(1)}px`);
        root.style.setProperty('--music-glow-alpha', `${(smoothedEnergy * 28).toFixed(1)}%`);
        root.style.setProperty('--music-tint-alpha', `${(smoothedEnergy * 20).toFixed(1)}%`);
        lastUpdate = time;
      }
      animationFrameRef.current = window.requestAnimationFrame(updateEnergy);
    };

    animationFrameRef.current = window.requestAnimationFrame(updateEnergy);
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [analysisReady, isEffectivelyMuted, playbackStatus]);

  const updateVolume = (nextVolume: number) => {
    setVolume(Math.min(100, Math.max(0, nextVolume)));
    tryStartPlayback();
  };

  const handleMuteClick = () => {
    if (playbackStatus !== 'playing') {
      setIsMuted(false);
      tryStartPlayback();
      return;
    }

    setIsMuted((muted) => !muted);
  };

  return (
    <div
      aria-label="Background music controls"
      className="flex shrink-0 items-center gap-1 border-l border-primary/20 pl-3"
      role="group"
    >
      <audio
        ref={audioRef}
        aria-label="Background soundtrack"
        loop
        onError={() => {
          setPlaybackStatus('error');
          console.error('The background soundtrack could not be loaded.');
        }}
        preload="auto"
        src={soundtrackUrl}
      />
      <button
        aria-label={
          playbackStatus === 'blocked'
            ? 'Start background music'
            : isEffectivelyMuted
              ? 'Unmute background music'
              : 'Mute background music'
        }
        className={buttonClassName}
        onClick={handleMuteClick}
        title={
          playbackStatus === 'blocked'
            ? 'Start background music'
            : isEffectivelyMuted
              ? 'Unmute background music'
              : 'Mute background music'
        }
        type="button"
      >
        {playbackStatus === 'blocked' ? (
          <Play aria-hidden="true" className="size-4" />
        ) : isEffectivelyMuted ? (
          <VolumeX aria-hidden="true" className="size-4" />
        ) : (
          <Volume2 aria-hidden="true" className="size-4" />
        )}
      </button>
      <button
        aria-label="Decrease music volume"
        className={buttonClassName}
        disabled={volume === 0}
        onClick={() => updateVolume(volume - 10)}
        title="Decrease music volume"
        type="button"
      >
        <Minus aria-hidden="true" className="size-3.5" />
      </button>
      <div className="w-20 sm:w-24">
        <Slider
          aria-label="Music volume"
          max={100}
          min={0}
          onValueChange={([nextVolume]) => updateVolume(nextVolume)}
          step={5}
          value={[volume]}
        />
      </div>
      <button
        aria-label="Increase music volume"
        className={buttonClassName}
        disabled={volume === 100}
        onClick={() => updateVolume(volume + 10)}
        title="Increase music volume"
        type="button"
      >
        <Plus aria-hidden="true" className="size-3.5" />
      </button>
      {playbackStatus === 'blocked' && (
        <span aria-live="polite" className="sr-only">
          Click to start background music.
        </span>
      )}
      {playbackStatus === 'error' && (
        <span aria-live="polite" className="sr-only">
          Background music could not be played.
        </span>
      )}
    </div>
  );
}
