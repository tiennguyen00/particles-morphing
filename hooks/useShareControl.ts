import { useControls } from "leva";
import { folder } from "leva";
import { useEffect, useState } from "react";

export const useShareControl = () => {
  const { QUANTITY: levaQuantity, SIZE } = useControls({
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

  // Debounce QUANTITY changes to avoid rapid recreations
  const [QUANTITY, setQUANTITY] = useState(levaQuantity);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setQUANTITY(levaQuantity);
    }, 300); // 300ms debounce delay

    return () => clearTimeout(debounceTimer);
  }, [levaQuantity]);

  return { QUANTITY, SIZE, NUMBER: QUANTITY * QUANTITY };
};
