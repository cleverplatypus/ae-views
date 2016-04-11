'use strict';

import aeManaged from './ae-managed';
import aeEach from './ae-each';
import aeState from './ae-state';
import aeCheckbox from './ae-checkbox';
import aeRadio from './ae-radio';
import aeAction from './ae-action';
import aeBind from './ae-bind';
import aeRender from './ae-render';
import aeSwitch from './ae-switch';


export default function(inPage) {

    aeManaged(inPage);
    aeEach(inPage);
    aeState(inPage);
    aeCheckbox(inPage);
    aeRadio(inPage);
    aeAction(inPage);
    aeBind(inPage);
    aeRender(inPage);
    aeSwitch(inPage);
};

