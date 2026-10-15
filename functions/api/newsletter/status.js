import {configured,json} from '../../_lib/newsletter.mjs';
export function onRequestGet({env}){return json({enabled:configured(env)});}
