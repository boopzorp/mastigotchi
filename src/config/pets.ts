
export interface PetImageDetails {
  url: string;
  hint: string;
}

export interface PetImages {
  happy: PetImageDetails;
  hungry: PetImageDetails;
  sad: PetImageDetails;
  dirty: PetImageDetails;
  content: PetImageDetails;
  default: PetImageDetails; // Fallback image
}

export interface PetType {
  id: string;
  name: string;
  images: PetImages;
  defaultName: string;
}

export const PET_TYPES: PetType[] = [
  {
    id: "pixelDog",
    name: "Pup",
    defaultName: "Plato",
    images: {
      happy: { url: "https://picsum.photos/seed/pixeldoghappy/300/300", hint: "pixel art dog happy" },
      hungry: { url: "https://picsum.photos/seed/pixeldoghungry/300/300", hint: "pixel art dog hungry" },
      sad: { url: "https://picsum.photos/seed/pixeldogsad/300/300", hint: "pixel art dog sad" },
      dirty: { url: "https://picsum.photos/seed/pixeldogdirty/300/300", hint: "pixel art dog dirty" },
      content: { url: "https://picsum.photos/seed/pixeldogcontent/300/300", hint: "pixel art dog content" },
      default: { url: "https://picsum.photos/seed/pixeldogdefault/300/300", hint: "pixel art dog" },
    },
  },
  {
    id: "pixelCat",
    name: "Kitty",
    defaultName: "Ares",
    images: {
      happy: { url: "https://picsum.photos/seed/pixelcathappy/300/300", hint: "pixel art cat happy" },
      hungry: { url: "https://picsum.photos/seed/pixelcathungry/300/300", hint: "pixel art cat hungry" },
      sad: { url: "https://picsum.photos/seed/pixelcatsad/300/300", hint: "pixel art cat sad" },
      dirty: { url: "https://picsum.photos/seed/pixelcatdirty/300/300", hint: "pixel art cat dirty" },
      content: { url: "https://picsum.photos/seed/pixelcatcontent/300/300", hint: "pixel art cat content" },
      default: { url: "https://picsum.photos/seed/pixelcatdefault/300/300", hint: "pixel art cat" },
    },
  },
  {
    id: "pixelRabbit",
    name: "Bunny",
    defaultName: "Loki",
    images: {
      happy: { url: "https://picsum.photos/seed/pixelrabbithappy/300/300", hint: "pixel art rabbit happy" },
      hungry: { url: "https://picsum.photos/seed/pixelrabbithungry/300/300", hint: "pixel art rabbit hungry" },
      sad: { url: "https://picsum.photos/seed/pixelrabbitsad/300/300", hint: "pixel art rabbit sad" },
      dirty: { url: "https://picsum.photos/seed/pixelrabbitdirty/300/300", hint: "pixel art rabbit dirty" },
      content: { url: "https://picsum.photos/seed/pixelrabbitcontent/300/300", hint: "pixel art rabbit content" },
      default: { url: "https://picsum.photos/seed/pixelrabbitdefault/300/300", hint: "pixel art rabbit" },
    },
  },
  {
    id: "pixelGoat",
    name: "Goat",
    defaultName: "Lucy",
    images: {
      happy: { url: "https://picsum.photos/seed/pixelrabbithappy/300/300", hint: "pixel art goat happy" },
      hungry: { url: "https://picsum.photos/seed/pixelrabbithungry/300/300", hint: "pixel art goat hungry" },
      sad: { url: "https://picsum.photos/seed/pixelrabbitsad/300/300", hint: "pixel art goat sad" },
      dirty: { url: "https://picsum.photos/seed/pixelrabbitdirty/300/300", hint: "pixel art goat dirty" },
      content: { url: "https://picsum.photos/seed/pixelrabbitcontent/300/300", hint: "pixel art goat content" },
      default: { url: "https://picsum.photos/seed/pixelrabbitdefault/300/300", hint: "pixel art goat" },
    },
  },
  {
    id: "pixelDuck",
    name: "Duck",
    defaultName: "Judas",
    images: {
      happy: { url: "https://picsum.photos/seed/pixelrabbithappy/300/300", hint: "pixel art duck happy" },
      hungry: { url: "https://picsum.photos/seed/pixelrabbithungry/300/300", hint: "pixel art duck hungry" },
      sad: { url: "https://picsum.photos/seed/pixelrabbitsad/300/300", hint: "pixel art duck sad" },
      dirty: { url: "https://picsum.photos/seed/pixelrabbitdirty/300/300", hint: "pixel art duck dirty" },
      content: { url: "https://picsum.photos/seed/pixelrabbitcontent/300/300", hint: "pixel art duck content" },
      default: { url: "https://picsum.photos/seed/pixelrabbitdefault/300/300", hint: "pixel art duck" },
    },
  },
  {
    id: "pixelFrog",
    name: "Frog",
    defaultName: "Hermes",
    images: {
      happy: { url: "https://picsum.photos/seed/pixelrabbithappy/300/300", hint: "pixel art duck happy" },
      hungry: { url: "https://picsum.photos/seed/pixelrabbithungry/300/300", hint: "pixel art duck hungry" },
      sad: { url: "https://picsum.photos/seed/pixelrabbitsad/300/300", hint: "pixel art duck sad" },
      dirty: { url: "https://picsum.photos/seed/pixelrabbitdirty/300/300", hint: "pixel art duck dirty" },
      content: { url: "https://picsum.photos/seed/pixelrabbitcontent/300/300", hint: "pixel art duck content" },
      default: { url: "https://picsum.photos/seed/pixelrabbitdefault/300/300", hint: "pixel art duck" },
    },
  },
];
