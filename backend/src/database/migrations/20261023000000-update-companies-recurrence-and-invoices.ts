import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    console.log("🚀 Iniciando migración 20261023000000: update-companies-recurrence-and-invoices...");

    // 1. Actualizar registros existentes con 'MENSAL' o vacío a 'MENSUAL' en la tabla Companies
    try {
      await queryInterface.sequelize.query(
        `UPDATE "Companies" 
         SET "recurrence" = 'MENSUAL' 
         WHERE "recurrence" = 'MENSAL' OR "recurrence" IS NULL OR "recurrence" = '';`
      );
      console.log("✅ Registros de Companies actualizados a recurrence = 'MENSUAL'");
    } catch (e: any) {
      console.error("⚠️ Error actualizando recurrence en Companies:", e.message);
    }

    // 2. Establecer 'MENSUAL' como valor predeterminado de la columna recurrence
    try {
      await queryInterface.changeColumn("Companies", "recurrence", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "MENSUAL"
      });
      console.log("✅ Columna recurrence configurada con defaultValue = 'MENSUAL'");
    } catch (e: any) {
      console.error("⚠️ Error modificando default de columna recurrence:", e.message);
    }

    // 3. Asegurar que las empresas con plan y fecha de vencimiento tengan una factura abierta en Invoices
    try {
      const companiesWithoutInvoices: any[] = await queryInterface.sequelize.query(
        `SELECT c.id, c."dueDate", c."planId", p.name as "planName", p.value as "planValue"
         FROM "Companies" c
         INNER JOIN "Plans" p ON p.id = c."planId"
         WHERE c."dueDate" IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM "Invoices" i 
             WHERE i."companyId" = c.id AND i.status = 'open'
           );`,
        { type: QueryTypes.SELECT }
      );

      for (const comp of companiesWithoutInvoices) {
        const now = new Date().toISOString();
        await queryInterface.sequelize.query(
          `INSERT INTO "Invoices" (detail, status, value, "createdAt", "updatedAt", "dueDate", "companyId")
           VALUES (:detail, 'open', :value, :createdAt, :updatedAt, :dueDate, :companyId);`,
          {
            replacements: {
              detail: comp.planName,
              value: comp.planValue,
              createdAt: now,
              updatedAt: now,
              dueDate: comp.dueDate,
              companyId: comp.id
            }
          }
        );
        console.log(`✅ Factura abierta generada para empresa ID ${comp.id} (${comp.planName})`);
      }
    } catch (e: any) {
      console.error("⚠️ Error sincronizando facturas en Invoices:", e.message);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.changeColumn("Companies", "recurrence", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ""
      });
    } catch (e: any) {
      console.error("⚠️ Error revirtiendo defaultValue en Companies:", e.message);
    }
  }
};
