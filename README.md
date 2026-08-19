# The Feline Line — HTML version

I know zero about game engines so the game is html cuz all my knowledge of coding is from doing basic creative coding before with p5.js and some Java for AP 

## Credits

Code Assist(in History part info on what parts): Claude
Art by me
main music loop: Week17 Alley Cat https://tallbeard.itch.io/music-loop-bundle
sfx: 
https://pixabay.com/sound-effects/nature-cat-meowing-560852/
https://pixabay.com/sound-effects/nature-loud-cat-meow-548593/
https://pixabay.com/sound-effects/cat-meow-fx-461188/
https://pixabay.com/sound-effects/film-special-effects-cat-crash-446935/
https://pixabay.com/sound-effects/nature-kitten-cat-meow-437244/
https://pixabay.com/sound-effects/nature-cat-meow-377318/
https://pixabay.com/sound-effects/film-special-effects-pow-90398/



## History

-14 planning 
-16 basic prototype (AI debug + progress bar and waves assist)
-17 menu, merging (AI assist at figuring out merging)
-18 sound, camera shake, reconstruction for easier changes

pics:
-14,15 https://file.garden/ajLT4NQpd3Qn0jIC/Core2026.png

previous versions
-17 https://github.com/Soyamurr/thefelinelineau17.git
-18 

## Before playing

Open `script.js` and replace every `YOUR_FILEGARDEN_...` and `YOUR_CATBOX_...` value with your real URLs.

The code deliberately does not invent hosting URLs because the actual asset URLs were not included in the supplied file.

## Files

- index.html
- style.css
- script.js
- README.md
- assets
  - audio  (wanted to do diff meaws for each cat placement but got lazy so the other meaws are reused for other purposes)

## Run

Go to itch.io:


Or


You can open `index.html` directly for many parts of the game, but a local HTTP server is safer for testing hosted assets:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
