(function() {

	let _initialized = false;
	const _components = new WeakSet();

    class Binda {
        constructor() {

        }

        component(inInitObj, inCallback) {
        	
        	let component = new Component(inInitObj);
        	inCallback && inCallback(component);
        }

        registerNode(inNode) {

		}

        page() {
        	$(function() {

        	});
        	Promise.resolve(_pageBus, _pageModel);
        }
    }

    class Component {

    	constructor(inInitObj) {
    		this.scope = inInitObj.scope;
    		this.model = ObservableObject.fromObject({ data : inInitObj.data });

    	}
    }


    class Bus {
    	constructor(inParentBus) {
    		this.parent = () =>inParentBus;
    	}

    	exportAction(inName, inHandler) {
    		if(this.parent()) {
    			this.parent().exportAction(inName, inHandler);
    		} else {
    			this.addAction(inName, inHandler)
    		}
    	}

    	addAction(inName, inHandler) {
    		this.signals[inName] = new signals.Signal();
    		if(inHandler) {
    			this.signals[inName].add(inHandler);
    		}
    	}

    	onAction(inName, inHandler) {
    		if(!this.signals[inName]) {
    			if(this.parent()) {
    				this.parent().onAction(inName, inHandler);
    			} else {
    				console.warn('registering listener to non existing action: ' + inName);
    			}

    		}
    	}
    }

    const binda = new Binda();

    window.ae = () => binda;
})();
