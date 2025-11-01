import { Howl } from "howler";
import success1 from "../assets/sounds/success1.wav";

export const successHowl = new Howl({
  src: [success1],
  autoplay: false,
  loop: false,
});
