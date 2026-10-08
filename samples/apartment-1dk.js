globalThis.GridoriSample = {
    "version":  3,
    "units":  "mm",
    "grid":  {
                 "major":  910,
                 "minor":  455
             },
    "walls":  [
                  {
                      "id":  "w1",
                      "type":  "wall",
                      "x":  910,
                      "y":  910,
                      "length":  4550,
                      "angle":  0,
                      "thickness":  140
                  },
                  {
                      "id":  "w2",
                      "type":  "wall",
                      "x":  910,
                      "y":  3640,
                      "length":  4550,
                      "angle":  0,
                      "thickness":  140
                  },
                  {
                      "id":  "w3",
                      "type":  "wall",
                      "x":  910,
                      "y":  910,
                      "length":  2730,
                      "angle":  90,
                      "thickness":  140
                  },
                  {
                      "id":  "w4",
                      "type":  "wall",
                      "x":  5460,
                      "y":  910,
                      "length":  2730,
                      "angle":  90,
                      "thickness":  140
                  },
                  {
                      "id":  "w5",
                      "type":  "wall",
                      "x":  910,
                      "y":  3640,
                      "length":  4550,
                      "angle":  90,
                      "thickness":  140
                  },
                  {
                      "id":  "w6",
                      "type":  "wall",
                      "x":  1820,
                      "y":  3640,
                      "length":  1365,
                      "angle":  90,
                      "thickness":  140
                  },
                  {
                      "id":  "w7",
                      "type":  "wall",
                      "x":  2730,
                      "y":  3640,
                      "length":  1820,
                      "angle":  90,
                      "thickness":  140
                  },
                  {
                      "id":  "w8",
                      "type":  "wall",
                      "x":  910,
                      "y":  4550,
                      "length":  910,
                      "angle":  0,
                      "thickness":  140
                  },
                  {
                      "id":  "w9",
                      "type":  "wall",
                      "x":  2730,
                      "y":  6370,
                      "length":  1820,
                      "angle":  90,
                      "thickness":  140
                  },
                  {
                      "id":  "w10",
                      "type":  "wall",
                      "x":  910,
                      "y":  6370,
                      "length":  1820,
                      "angle":  0,
                      "thickness":  140
                  },
                  {
                      "id":  "w11",
                      "type":  "wall",
                      "x":  910,
                      "y":  8190,
                      "length":  4550,
                      "angle":  0,
                      "thickness":  140
                  },
                  {
                      "id":  "w12",
                      "type":  "wall",
                      "x":  5460,
                      "y":  3640,
                      "length":  4550,
                      "angle":  90,
                      "thickness":  140
                  },
                  {
                      "id":  "w27",
                      "type":  "wall",
                      "x":  1820,
                      "y":  5005,
                      "length":  910,
                      "angle":  0,
                      "thickness":  140
                  }
              ],
    "fixtures":  [
                     {
                         "id":  "f13",
                         "type":  "doubleSlidingDoor",
                         "x":  2821,
                         "y":  3640,
                         "width":  1650,
                         "height":  140,
                         "label":  "引き違い戸",
                         "angle":  0,
                         "centerline":  true
                     },
                     {
                         "id":  "f14",
                         "type":  "foldingDoor",
                         "x":  980,
                         "y":  3640,
                         "width":  760,
                         "height":  140,
                         "label":  "折戸",
                         "angle":  0,
                         "centerline":  true,
                         "foldDirection":  "left",
                         "foldSide":  -1
                     },
                     {
                         "id":  "f16",
                         "type":  "wash",
                         "x":  1363.9999389648438,
                         "y":  4620,
                         "width":  750,
                         "height":  606.6666666666666,
                         "label":  "洗面",
                         "angle":  0,
                         "origin":  "backCenter"
                     },
                     {
                         "id":  "f17",
                         "type":  "toilet",
                         "x":  2275,
                         "y":  4095,
                         "width":  380,
                         "height":  650,
                         "label":  "トイレ",
                         "angle":  0,
                         "origin":  "center"
                     },
                     {
                         "id":  "f18",
                         "type":  "door",
                         "x":  1975,
                         "y":  5005,
                         "width":  650,
                         "height":  140,
                         "label":  "ドア",
                         "angle":  0,
                         "centerline":  true,
                         "handing":  "right",
                         "swingSide":  1
                     },
                     {
                         "id":  "f19",
                         "type":  "foldingDoor",
                         "x":  1900,
                         "y":  6370,
                         "width":  760,
                         "height":  140,
                         "label":  "折戸",
                         "angle":  0,
                         "centerline":  true,
                         "foldDirection":  "right",
                         "foldSide":  1
                     },
                     {
                         "id":  "f20",
                         "type":  "bath",
                         "x":  910,
                         "y":  6370,
                         "width":  1820,
                         "height":  1820,
                         "label":  "UB",
                         "angle":  270,
                         "wallThickness":  140
                     },
                     {
                         "id":  "f21",
                         "type":  "kitchen",
                         "kitchenKind":  "sink",
                         "origin":  "backCenter",
                         "x":  2797.0004272460938,
                         "y":  6693.000793457031,
                         "width":  750,
                         "height":  600,
                         "angle":  270,
                         "label":  "キッチン"
                     },
                     {
                         "id":  "f23",
                         "type":  "kitchen",
                         "kitchenKind":  "stove",
                         "origin":  "backCenter",
                         "x":  2800.0000000000005,
                         "y":  7743.000793457031,
                         "width":  750,
                         "height":  600,
                         "angle":  270,
                         "label":  "キッチン",
                         "growthDirection":  1
                     },
                     {
                         "id":  "f24",
                         "type":  "kitchen",
                         "kitchenKind":  "counter",
                         "origin":  "backCenter",
                         "x":  2800,
                         "y":  7217.001647949219,
                         "width":  300,
                         "height":  600,
                         "angle":  270,
                         "label":  "キッチン",
                         "growthDirection":  1,
                         "cornerSide":  "right"
                     },
                     {
                         "id":  "f25",
                         "type":  "door",
                         "x":  4550,
                         "y":  8190,
                         "width":  800,
                         "height":  140,
                         "label":  "ドア",
                         "angle":  0,
                         "centerline":  true,
                         "handing":  "left",
                         "swingSide":  1
                     },
                     {
                         "id":  "f26",
                         "type":  "window",
                         "x":  2821,
                         "y":  910,
                         "width":  1650,
                         "height":  140,
                         "label":  "窓",
                         "angle":  0,
                         "centerline":  true
                     },
                     {
                         "id":  "f28",
                         "type":  "washer",
                         "x":  1001,
                         "y":  5642,
                         "width":  640,
                         "height":  640,
                         "label":  "洗濯機",
                         "angle":  0
                     },
                     {
                         "id":  "f29",
                         "type":  "window",
                         "x":  3700,
                         "y":  8190,
                         "width":  760,
                         "height":  140,
                         "label":  "窓",
                         "angle":  0,
                         "centerline":  true
                     }
                 ],
    "page":  {
                 "x":  0,
                 "y":  0,
                 "width":  7280,
                 "height":  10010
             }
};