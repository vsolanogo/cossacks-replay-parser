import { Howl } from "howler";
import pop1 from "../assets/sounds/pop1.ogg";

export const pop = new Howl({
  src: [pop1],
  autoplay: false,
  loop: false,
});
