import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    console.log('🔄 Agregando columna connectionType a Whatsapp...');
    
    const tableName = 'Whatsapps';
    
    let tableExists = false;
    try {
      await queryInterface.describeTable(tableName);
      tableExists = true;
    } catch (error: any) {
      if (error.name === 'SequelizeDatabaseError' && error.original?.code === '42P01') {
        console.log(`⚠️ La tabla ${tableName} no existe. Esta migración se ejecutará cuando la tabla sea creada.`);
        return;
      }
      throw error;
    }
    
    if (!tableExists) {
      return;
    }
    
    try {
      const tableInfo: any = await queryInterface.describeTable(tableName);
      
      if (!tableInfo.connectionType) {
        await queryInterface.addColumn(tableName, 'connectionType', {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: 'baileys'
        });
        console.log('✅ Columna connectionType agregada');
      } else {
        console.log('⚠️ La columna connectionType ya existe');
      }
      
    } catch (error) {
      console.error('❌ Error en migración:', error);
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    console.log('🔄 Revirtiendo columna connectionType...');
    
    const tableName = 'Whatsapps';
    
    try {
      await queryInterface.removeColumn(tableName, 'connectionType');
      console.log('✅ Columna connectionType removida');
    } catch (error) {
      console.error('❌ Error revirtiendo migración:', error);
      throw error;
    }
  }
};

