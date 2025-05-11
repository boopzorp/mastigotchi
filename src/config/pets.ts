
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
  /*{
    id: "pixelDog",
    name: "Pup",
    defaultName: "Plato",
    images: {
      happy: { url: "/images/dog/happy.png", hint: "pixel art dog happy" },
      hungry: { url: "/images/dog/hungry.png", hint: "pixel art dog hungry" },
      sad: { url: "/images/dog/sad.png", hint: "pixel art dog sad" },
      dirty: { url: "/images/dog/dirty.png", hint: "pixel art dog dirty" },
      content: { url: "/images/dog/content.png", hint: "pixel art dog content" },
      default: { url: "/images/dog/default.png", hint: "pixel art dog" },
    },
  },*/
  {
    id: "pixelCat",
    name: "Kitty",
    defaultName: "Ares",
    images: {
      happy: { url: "/images/cat/happy.gif", hint: "pixel art cat happy" },
      hungry: { url: "/images/cat/hungry.gif", hint: "pixel art cat hungry" },
      sad: { url: "/images/cat/sad.gif", hint: "pixel art cat sad" },
      dirty: { url: "/images/cat/dirty.gif", hint: "pixel art cat dirty" },
      content: { url: "/images/cat/content.gif", hint: "pixel art cat content" },
      default: { url: "/images/cat/default.gif", hint: "pixel art cat" },
    },
  },
  // Add more pet types as needed
  /*{
    id: "pixelRabbit",
    name: "Bunny",
    defaultName: "Loki",
    images: {
      happy: { url: "/images/rabbit/happy.png", hint: "pixel art rabbit happy" },
      hungry: { url: "/images/rabbit/hungry.png", hint: "pixel art rabbit hungry" },
      sad: { url: "/images/rabbit/sad.png", hint: "pixel art rabbit sad" },
      dirty: { url: "/images/rabbit/dirty.png", hint: "pixel art rabbit dirty" },
      content: { url: "/images/rabbit/content.png", hint: "pixel art rabbit content" },
      default: { url: "/images/rabbit/default.png", hint: "pixel art rabbit" },
    },
  },*/
  {
    id: "pixelDuck",
    name: "Duck",
    defaultName: "Judas",
    images: {
      happy: { url: "/images/duck/happy.gif", hint: "pixel art duck happy" },
      hungry: { url: "/images/duck/hungry.gif", hint: "pixel art duck hungry" },
      sad: { url: "/images/duck/sad.gif", hint: "pixel art duck sad" },
      dirty: { url: "/images/duck/dirty.gif", hint: "pixel art duck dirty" },
      content: { url: "/images/duck/default.gif", hint: "pixel art duck content" },
      default: { url: "/images/duck/default.gif", hint: "pixel art duck" },
    },
  },
  /*{
    id: "pixelCow",
    name: "Cow",
    defaultName: "Hermes",
    images: {
      happy: { url: "/images/cow/happy.png", hint: "pixel art duck happy" },
      hungry: { url: "/images/cow/hungry.png", hint: "pixel art duck hungry" },
      sad: { url: "/images/cow/sad.png", hint: "pixel art duck sad" },
      dirty: { url: "/images/cow/dirty.png", hint: "pixel art duck dirty" },
      content: { url: "/images/cow/content.png", hint: "pixel art duck content" },
      default: { url: "/images/cow/default.png", hint: "pixel art duck" },
    },
  },*/
];
