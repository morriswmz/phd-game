# PhD Simulator

## About

Technically a random event driven text-based game.

You can [play it here](https://research.wmz.ninja/projects/phd/index.html)
(using modern browsers or mobile devices).

Random events are defined in [YAML files](static/rulesets/default). Therefore,
the game is easily moddable,

Not actively maintained.

## Build and Play Locally

After cloning the repository and running `npm install`, run

```
npm run build && npm start
```

and then navigate to http://localhost:8000 in your browser. Built bundle will be
outputted to the `dist` directory.

> [!NOTE] 
> The rulesets in this repo can be different from the online version hosted on
> my website.

## License

MIT
