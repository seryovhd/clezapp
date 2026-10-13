import React from "react";
import ReactDOM from "react-dom";
import CssBaseline from "@material-ui/core/CssBaseline";
import { register } from './serviceWorker';  // Importando a função register corretamente

import App from "./App";

ReactDOM.render(
	<App />,
	document.getElementById("root"),
	() => {
		window.finishProgress();
	}
);

// Registrar o service worker
register();
