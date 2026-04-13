import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneRecord } from "@/lib/types";

type Props = {
  scenes: SceneRecord[];
};

function AnimatedCaptions({ scene }: { scene: SceneRecord }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div className="absolute inset-x-12 bottom-24">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.6rem",
          justifyContent: "center"
        }}
      >
        {scene.subtitles.map((word, index) => {
          const startFrame = Math.round(word.start * fps);
          const endFrame = Math.max(startFrame + 2, Math.round(word.end * fps));
          const active = frame >= startFrame && frame <= endFrame;
          const opacity = active ? 1 : 0.35;
          const scale = spring({
            frame: frame - startFrame,
            fps,
            config: { damping: 16, mass: 0.6 }
          });

          return (
            <span
              key={`${word.word}-${index}`}
              style={{
                fontFamily: "Manrope, sans-serif",
                fontWeight: 800,
                fontSize: 48,
                lineHeight: 1.1,
                color: active ? "#ffffff" : "rgba(255,255,255,0.55)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                transform: `scale(${active ? 1 + scale * 0.04 : 1})`,
                textShadow: active ? "0 0 20px rgba(176,38,255,0.9)" : "none",
                opacity
              }}
            >
              {word.word}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export const KlonStudioVideo: React.FC<Props> = ({ scenes }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at top, rgba(176,38,255,0.22), transparent 30%), linear-gradient(180deg, #020204, #09070f 60%, #020204)",
        color: "#fff"
      }}
    >
      {scenes.map((scene, index) => {
        const durationInFrames = Math.max(1, Math.round(scene.duration * fps));
        const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp"
        });

        return (
          <Sequence
            key={scene.id}
            from={scenes.slice(0, index).reduce((sum, item) => sum + Math.round(item.duration * fps), 0)}
            durationInFrames={durationInFrames}
          >
            <AbsoluteFill
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.65)), url(${scene.referenceImage})`,
                backgroundSize: `${104 + progress * 4}%`,
                backgroundPosition: "center center",
                backgroundRepeat: "no-repeat"
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 36,
                  borderRadius: 42,
                  border: "1px solid rgba(255,255,255,0.12)"
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 80,
                  left: 64,
                  fontFamily: "Syncopate, sans-serif",
                  fontSize: 26,
                  letterSpacing: "0.2em"
                }}
              >
                {scene.label}
              </div>
              <AnimatedCaptions scene={scene} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
