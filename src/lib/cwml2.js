//loads cwml things if they didn't loaded yet
function load() {
    //style of declared tags
    if(document.querySelector('#cwml-style') == undefined) {
        // <style id="cwml-style">
        var cwmlStyle = document.createElement('style')
        cwmlStyle.id = 'cwml-style'
        cwmlStyle.setAttribute('scoped', '')
        document.querySelector('head').appendChild(cwmlStyle)
    }
}

export const cwml = {
    // Custom tags...
    declaredTags: {},
    tag: function($tag, $attrs={}, $events={}, $style={}, $content=``) {
        load()
        
        if($tag == undefined || $tag.trim() == '')
            throw new Error('You should specify tag which will be declared')

        window.customElements.define($tag.toLowerCase(), 
            class CwmlTag extends HTMLElement { 
                attrs = {} //tag observed attributes
                events = {} //tag observed events
                content = `` //tag content template
                initialInner = `` //initial inner html of current dom element

                constructor(){
                    //init
                    super()
                    this.attrs = $attrs
                    this.events = $events
                    this.content = $content
                    this.initialInner = this.innerHTML
                    //events
                    for(var event_name in this.events) {
                        var event_func = this.events[event_name]
                        //if its default event (not nondefault like '__adopted__', etc)
                        if(!event_name.startsWith('__')) {
                            this.addEventListener(event_name, function(e) { event_func(e.target) } )
                        }
                    }
                    //content
                    if(this.content != '') {
                        let _content = this.content.replaceAll('{inner}', this.initialInner)
                        if(this.hasAttributes()) {
                            for(var attr in this.attributes) {
                                _content = _content.replaceAll('{'+this.attributes[attr].name+'}', this.attributes[attr].textContent)
                            }
                        }
                        this.innerHTML = _content
                    }
                }

                connectedCallback() { 
                    //call event '__added__' (if handled)
                    if(this.events['__added__'] !== undefined)
                        this.events['__added__'](this)
                }
                disconnectedCallback() { 
                    //call event '__removed__' (if handled)
                    if(this.events['__removed__'] !== undefined)
                        this.events['__removed__'](this)
                }
                adoptedCallback() { 
                    //call event '__adopted__' (if handled)
                    if(this.events['__adopted__'] !== undefined)
                        this.events['__adopted__'](this)
                }

                static get observedAttributes() {
                    let observed = []
                    // without/with observers
                    if($attrs.constructor == Array) { observed = $attrs }
                    else if($attrs.constructor == Object) { observed = Object.keys($attrs) }
                    //observe cwml-dynamic attr
                    observed.push('cwml-dynamic')

                    return observed
                }
                attributeChangedCallback(attrName, oldVal, newVal) {
                    // call attrs observers
                    if(this.attrs.constructor == Object) {
                        //call attribute change (if this attribute is observed)
                        if(this.attrs[attrName] !== undefined)
                            this.attrs[attrName](this, oldVal, newVal)
                    }
                    // reactive content
                    if(this.content != '' && (!this.hasAttribute('cwml-dynamic') || this.attributes['cwml-dynamic'] == 'false')) {
                        //apply '{inner}'
                        let _content = this.content.replaceAll('{inner}', this.initialInner)
                        //apply attributes values
                        for(var attr in this.attributes) {
                            _content = _content.replaceAll('{'+this.attributes[attr].name+'}', this.attributes[attr].value)
                        }

                        //update DOM
                        this.innerHTML = _content
                    }
                }
            }
        );

        //form CSS from style object
        var css = Object.keys($style).map(function(prop) {
            return `${prop}: ${$style[prop]};`
        }).join('')
        //display as block (if 'display' value isn't set)
        css += css.includes('display:') ? '' : 'display: block;'
        //add style of this tag to stylesheet (<style id="cwml-style">)
        document.querySelector('#cwml-style').innerText += `${$tag} {${css}}\n`

        //initialize
        this.declaredTags[$tag] = {
            attributes: Object.keys($attrs),
            events: Object.keys($events),
            style: Object.keys($style),
            content: $content
        }

        //call tag initialization event
        $events['__init__'] !== undefined ? $events['__init__'](this) : undefined
    },
    isTagSupported: function(tag) {
        return this.declaredTags[tag] !== undefined
    },

    // Custom attributes...
    declaredAttrs: {},
    attr: function($query, $attr, $callback=function(el,newVal){}) {
        var targets = document.querySelectorAll($query);

        //every target on page
        targets.forEach(target => {
            //callback if attr value set
            if(target.hasAttribute($attr)) {
                //do callback (page is loaded)
                $callback(target, target.attributes[$attr].value);
            }

            //observe attributes
            new MutationObserver((mutations, observer) => {
                for(let mutation of mutations) {
                    //if mutation is attribute && observed attribute mutated
                    if(mutation.type == 'attributes' && mutation.attributeName == $attr) {
                        //do callback (attr is changed)
                        $callback(mutation.target, mutation.target.attributes[$attr].value);
                    }
                }
            }).observe(target, { attributes: true });
        });

        //initialize
        this.declaredAttrs[$attr] = {
            query: $query
        };
    },
    isAttrSupported: function(attr) {
        //check custom attributes
        if(this.declaredAttrs[attr] !== undefined) { return true; }
        
        //check custom tags attributes
        this.declaredTags.forEach(tag => {
            if(tag.attributes.includes(attr)) {
                return true;
            }
        });

        //-> not found
        return false;
    },
}