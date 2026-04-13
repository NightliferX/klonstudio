import { Composition } from "remotion";
import { KlonStudioVideo } from "@/remotion/VideoComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="KlonStudioVideo"
        component={KlonStudioVideo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          scenes: []
        }}
      />
    </>
  );
};

export default RemotionRoot;
