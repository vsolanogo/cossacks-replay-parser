import { Howl } from 'howler';
  import popogg from '$lib/assets/sounds/pop1.ogg'; 

  import successwav from '$lib/assets/sounds/success1.wav'; 


export const pop = new Howl({
  src: [popogg],
  volume: 0.5,
});

export const successHowl = new Howl({
  src: [successwav],
  volume: 0.5,
});