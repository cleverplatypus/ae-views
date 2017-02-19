{
    function flattenArray(inRoot) {
    
                var out = [];
        inRoot.forEach((inVal) => {
            if(typeof inVal === 'string') {
                out.push(inVal);
            } else {
            out = out.concat(joinArrayDeep(inVal));
            }
        });
        return out;
    }
    function joinArrayDeep(inRoot) {

        return flattenArray(inRoot).join('');
    }
}


expression "expression" = r:((binding / text))+ 

binding "binding" = s:[~#] a:(accessor ':'?)* '(' b:bindingPath p:parameters ')' { 
    return { 
        static : s === '#', 
         
            accessor : a.map((inVal) => inVal[0]), binding : b, params : p 
         
    };
}

accessor = w:(([a-zA-Z_][\-a-zA-Z_0-9]*)) { 
    return joinArrayDeep(w);
}

text = w:([a-zA-Z_0-9 ]+) { 
    return joinArrayDeep(w);
}

bindingPath = model:modelName? path:propertyPath { 
    return { modelName : model, path : path };
}

propertyName = w:([a-zA-Z_0-9]+) { 
    return w;
}


propertyPath = path:(propertyName ('.' propertyName)*) { 
    return joinArrayDeep(path);
}

parameter = (boolean / string / number)

parameters = p:(' '* ',' ' '* parameter ' '*)* { 
    return p.map((inParam) => inParam[3]);
}

boolean = b:('true' / 'false')  { return Boolean(b)}

string = w:('`' [^`]* '`') { 
    return joinArrayDeep(w[1]);
}

number = sign:('-')? i:([0-9]+) d:('.' ([0-9]+))? {
    sign = sign || '';
    d = d || [];
    return Number(sign + joinArrayDeep(i) + joinArrayDeep(d));
}

modelName = w:([a-zA-Z_][a-zA-Z_0-9]*) ':'  { 
    return joinArrayDeep(w);
}
    
