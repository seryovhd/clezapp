import express from "express";
import isAuth from "../middleware/isAuth"; // Autenticación del usuario
import * as HubNotificaMeController from "../controllers/HubNotificaMeController"; // Adaptado para el controlador de HubNotificaMe

const routes = express.Router();

// Ruta para listar HubNotificaMe (solo registros del usuario y empresa de la sesión)
routes.get("/hub-notificame/list", isAuth, HubNotificaMeController.findList);

// Ruta para crear un nuevo HubNotificaMe
routes.post("/hub-notificame", isAuth, HubNotificaMeController.store);

// Ruta para actualizar un HubNotificaMe existente
routes.put("/hub-notificame/:id", isAuth, HubNotificaMeController.update);

// Ruta para eliminar un HubNotificaMe
routes.delete("/hub-notificame/:id", isAuth, HubNotificaMeController.remove);

export default routes;

