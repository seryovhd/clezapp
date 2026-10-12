import React from 'react';
import { parse } from 'vcard-parser';

const vcardStyle = {
    backgroundColor: '#f9f9f9',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    width: '300px',
    margin: '20px auto',
};

const infoStyle = {
    margin: '5px 0',
    fontSize: '16px',
};

const VcardPreview = ({ messageBody }) => {
    // Verificar si messageBody contiene datos válidos
    if (!messageBody) {
        return <div>No se encontraron datos para mostrar.</div>;
    }

    try {
        const vcardObject = parse(messageBody);
        const contact = vcardObject.FN || "Nombre no disponible";
        const number = vcardObject.TEL?.value || "Número no disponible";

        return (
            <div style={vcardStyle}>
                <h2>Vista previa de la tarjeta de contacto</h2>
                <div>
                    <p style={infoStyle}>Nombre: {contact}</p>
                    <p style={infoStyle}>Número de WhatsApp: {number}</p>
                </div>
            </div>
        );
    } catch (error) {
        return <div>Error al procesar la vCard: {error.message}</div>;
    }
};

export default VcardPreview;
