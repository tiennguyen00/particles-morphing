import { useControls } from "leva";
import { folder } from "leva";

export const useShareControl = () => {
  const { QUANTITY, SIZE } = useControls({
    points: folder({
      QUANTITY: {
        options: {
          "64x64": 64,
          "128x128": 128,
          "256x256": 256,
          "512x512": 512,
          "1024x1024": 1024,
          "2048x2048": 2048,
        },
        value: 256,
      },
      SIZE: {
        value: 0.012,
        step: 0.001,
      },
    }),
  });

  return { QUANTITY, SIZE, NUMBER: QUANTITY * QUANTITY };
};
