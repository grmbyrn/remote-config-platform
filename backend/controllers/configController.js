import {getConfig} from '../services/config.js'

export function getConfigHandler(req, res){
    res.json(getConfig())
}