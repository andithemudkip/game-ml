class QGML {
    constructor () {
        this.p5 = null;
        this.gameManager = null;
    }
    static setup (config) {
        this.gameManager = new this.GameManager (config);
        this.gameManager.createWorlds ();
        this.ctx = new QGML.Context ();
        this.gameManager.createKeymappers ();
        this.p5 = new p5 (QGML.createSketch (config), config.rootElementID);
    }

    static createSketch (config) {
        const { width, height, assets } = config;

        return function (p) {
            p.setup = function () {
                let canvas = p.createCanvas (width, height);
                QGML.ctx.setVar ('p5', p);

                p.background (0);
                p.fill (255);

                QGML.ctx.eval (QGML.gameManager.scripts [QGML.World.current.id] ['setup']);
            }
            p.draw = function () {
                if (QGML.debug && p.frameCount % 60 === 0) {
                    performance.mark ('start-of-draw');
                }
                
                p.background (0);
                for (let i = 0, n = QGML.gameManager.currentGroups.length; i < n; i++) {
                    QGML.gameManager.currentGroups [i].update ();
                }

                for (let i = 0, n = QGML.gameManager.currentActors.length; i < n; i++) {
                    QGML.gameManager.currentActors [i].draw (p);
                }

                for (let i = 0, n = QGML.gameManager.currentTexts.length; i < n; i++) {
                    QGML.gameManager.currentTexts [i].draw (p);
                }

                for (let i = 0,
                     keys = Object.keys (QGML.gameManager.keymappers [QGML.World.current.id].keys ["down"]),
                     n = keys.length; i < n; i++) {
                        if (p.keyIsDown (keys [i])) {
                            QGML.gameManager.keymappers [QGML.World.current.id].keys ["down"] [keys [i]] ();
                        }
                }
                for (let i = 0,
                    keys = Object.keys (QGML.gameManager.keymappers [QGML.World.current.id].keys ["up"]),
                    n = keys.length; i < n; i++) {
                       if (!p.keyIsDown (keys [i])) {
                           QGML.gameManager.keymappers [QGML.World.current.id].keys ["up"] [keys [i]] ();
                       }
                }
                

                QGML.ctx.eval (QGML.gameManager.scripts [QGML.World.current.id] ['update']);

                if (QGML.debug) {
                    p.fill (255);
                    p.text (`${Math.round (QGML.frameRate)} fps`, 5, 15);
                    p.text (`${QGML.frameTime.toFixed (3)} ms frame time`, 5, 35);

                    if (p.frameCount % 60 == 0) {
                        performance.measure ('measure frame time', 'start-of-draw');
                        let perf = performance.getEntriesByName ('measure frame time');
                        QGML.frameTime = perf [0].duration;
                        QGML.frameRate = p.frameRate ();
                        performance.clearMeasures ();
                    }
                }
            }
            p.keyPressed = function () {
                if (QGML.gameManager.keymappers [QGML.World.current.id].keys ["pressed"] [p.keyCode]) {
                    QGML.gameManager.keymappers [QGML.World.current.id].keys ["pressed"] [p.keyCode] ();
                }
            }
            p.keyReleased = function () {
                if (QGML.gameManager.keymappers [QGML.World.current.id].keys ["released"] [p.keyCode]) {
                    QGML.gameManager.keymappers [QGML.World.current.id].keys ["released"] [p.keyCode] ();
                }
            }
            
            
        }

    }
}

QGML.debug = true;
QGML.frameRate = 0;
QGML.frameTime = 0;

QGML.Context = function () {
    var _gmlVars = QGML.gameManager ? Object.assign ({},
        QGML.gameManager.vars ['global'],
        QGML.gameManager.vars [QGML.gameManager.selectedWorld.id]) : [];

    let keys = Object.keys (_gmlVars);

    for (key of keys) {
        try {
            eval (`var ${key} = ${_gmlVars [key]};`);
        } catch (err) {
            eval (`var ${key} = "${_gmlVars [key]}";`);
        }
    }

    /* user call-able functions here */

    function getEntity (id, type = "actor") {
        return QGML.World.current.actors.find (a => a.id === id);
    }

    this.eval = function (str, debug) {
        let res = eval (str)

        if (debug) console.log (res, str);

        for (key of keys) {
            if (QGML.gameManager.vars [QGML.World.current.id].hasOwnProperty (key)) {
                QGML.gameManager.setVar (QGML.World.current.id, key, eval (key));
            } else {
                QGML.gameManager.setVar ('global', key, eval (key));
            }
        }

        return res;
    }

    this.setVar = function (name, value) {
        this [name] = value;
    }
}

QGML.Keymapper = class Keymapper {
    constructor (obj) {
        this.keys = {
            down: {},
            up: {},
            pressed: {},
            released: {}
        }

        /*
        events:
            down - will fire every frame while the key is held down
            up - will fire every frame while the key is not held down
            pressed - will fire once when the key is pressed [DEFAULT]
            released - will fire once when the key is released
        */
        
        Object.keys (obj).forEach (key => {
            let opts = key.split ('|');
            let keyCode = QGML.Keymapper.keyCodeFromString (opts [0]);
            this.keys [opts [1] || 'pressed'] [keyCode] = QGML.ctx.eval (obj [key]);
        });
    }

    static keyCodeFromString (str) {
        let keyCode = 0;
        if (Number (str)) {
            keyCode = Number (str);
        } else {
            if (str.length === 1) {
                keyCode = str.toUpperCase ().charCodeAt (0);
            } else {
                Object.keys (QGML.Keymapper.keyTable).forEach (key => {
                    if (str.toUpperCase () === key) {
                        keyCode = QGML.Keymapper.keyTable [key];
                    }
                })
            }
        }
        return keyCode;
    }
}

QGML.Keymapper.keyTable = {
    BACKSPACE: 8,
    DELETE: 46,
    ENTER: 13,
    RETURN: 13,
    TAB: 9,
    ESCAPE: 27,
    SHIFT: 16,
    CONTROL: 17,
    OPTION: 18,
    ALT: 18,
    UP_ARROW: 38,
    DOWN_ARROW: 40,
    LEFT_ARROW: 37,
    RIGHT_ARROW: 39,
    SPACE: 32
}

QGML.Text = class Text {
    constructor ({ group = null, state = "", value = "", id = 'default-text' }, worldObj) {
        this.id = id;
        this.group = worldObj.groups.find (grp => grp.name === group);
        this.state = {
            position: {
                x: 0,
                y: 0
            },
            color: 255,
            stroke: false
        }
        this.value = value;
        this.originalValue = value;
        this.originalState = state;
    }

    draw (p) {

        let pos = {
            x: this.state.position.x,
            y: this.state.position.y
        }
        if (this.group) {
            pos.x += this.group.absolutePosition.x;
            pos.y += this.group.absolutePosition.y;
        }

        if (this.originalState) {
            this.state = QGML.ctx.eval (this.originalState);
            if (!this.state.color) this.state.color = 255;
            this.value = QGML.ctx.eval ("`" + this.originalValue + "`");
        }

        p.fill (p.color (this.state.color));
        p.text (this.value, pos.x, pos.y);

    }
 }

QGML.Actor = class Actor {
    constructor ({ group = null, state = "", id = 'default-actor' }, worldObj) {
        this.id = id;
        this.group = worldObj.groups.find (grp => grp.name === group);
        this.state = {
            position: {
                x: 0,
                y: 0
            },
            size: {
                width: 0,
                height: 0
            },
            color: 255
        };
        this.originalState = state;
    }

    draw (p) {
        if (this.state.size.width && this.state.size.height) {
            let pos = {
                x: this.state.position.x,
                y: this.state.position.y
            }
            if (this.group) {
                pos.x += this.group.absolutePosition.x;
                pos.y += this.group.absolutePosition.y;
            }
            p.fill (p.color (this.state.color));
            
            p.rect (pos.x, pos.y, this.state.size.width, this.state.size.height);
        }

        // update the state
        if (this.originalState) {
            this.state = QGML.ctx.eval (this.originalState);
        }
    }
}

QGML.Group = class Group {
    constructor ({ parent = null, world = 'default-world', name = 'default-group', state = {} }, worldObj) {
        this.parent = parent;
        this.world = world;
        this.name = name;
        
        this.state = {
            position: {
                x: 0,
                y: 0
            },
            size: {
                width: 0,
                height: 0
            }
        };
        this.originalState = state;
        this.absolutePosition = {
            x: 0,
            y: 0
        }
    }

    update () {
        if (!this.parentObject) {
            this.parentObject = QGML.World.current.groups.find (g => g.name === this.parent);
        }

        if (this.originalState) {
            this.state = QGML.ctx.eval (this.originalState);
            this.absolutePosition = this.state.position;
        }

        if (this.parent) {
            this.absolutePosition = {
                x: this.parentObject.state.position.x + this.state.position.x,
                y: this.parentObject.state.position.y + this.state.position.y
            }
        }
    }
}

QGML.World = class World {
    constructor ({ id = 'default-world', state = {}, groups = [], actors = [], texts = [], events = [] }) {
        this.id = id;
        this.state = state;
        this.groups = groups;
        this.actors = actors;
        this.texts = texts;
        this.events = events;
        this.createEntities = this.createEntities.bind (this);
    }
    createEntities () {
        this.groups = this.groups.map (group => new QGML.Group (group, this));
        this.actors = this.actors.map (actor => new QGML.Actor (actor, this));
        this.texts = this.texts.map (text => new QGML.Text (text, this));
    }
}

QGML.GameManager = class GameManager {
    constructor (config) {
        this.config = config;
        this.keymappers = {};
        this.scripts = config.scripts;
        
        this.vars = config.vars;
        this.defaultWorld = config.defaultWorld;
        this.selectedWorld = config.defaultWorld;
        
        this.loadWorld = this.loadWorld.bind (this);
        this.findWorld = this.findWorld.bind (this);
        this.createWorlds = this.createWorlds.bind (this);
        this.createKeymappers = this.createKeymappers.bind (this);
        
    }

    createWorlds () {
        this.worlds = this.config.worlds.map (world => new QGML.World (world));
        this.worlds.forEach (world => world.createEntities ());
        this.defaultWorld = this.config.defaultWorld;
        this.selectedWorld = this.defaultWorld;

        this.loadWorld (this.defaultWorld);
    }

    createKeymappers () {
        Object.keys (this.config.keymappers).forEach (key => {
            this.keymappers [key] = new QGML.Keymapper (this.config.keymappers [key]);
        });
    }

    setVar (world, name, value)  {
        this.vars [world] [name] = value;
    }

    loadWorld (world) {
        this.selectedWorld = this.findWorld (world);
        this.currentGroups = this.selectedWorld.groups;
        this.currentActors = this.selectedWorld.actors;
        this.currentTexts = this.selectedWorld.texts;
        QGML.World.current = this.selectedWorld;
    }

    findWorld (id) {
        return this.worlds.find (world => world.id === id);
    }
}