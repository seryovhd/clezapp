import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    console.log('🔄 Agregando campos de Facebook Messenger a Whatsapp...');
    
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
      await queryInterface.addColumn(tableName, 'facebookPageId', {
        type: DataTypes.TEXT,
        allowNull: true
      });
      console.log('✅ Columna facebookPageId agregada');

      // Agregar facebookPageName
      await queryInterface.addColumn(tableName, 'facebookPageName', {
        type: DataTypes.TEXT,
        allowNull: true
      });
      console.log('✅ Columna facebookPageName agregada');

      // Agregar facebookAccessToken
      await queryInterface.addColumn(tableName, 'facebookAccessToken', {
        type: DataTypes.TEXT,
        allowNull: true
      });
      console.log('✅ Columna facebookAccessToken agregada');

      // Agregar facebookTokenExpiresAt
      await queryInterface.addColumn(tableName, 'facebookTokenExpiresAt', {
        type: DataTypes.DATE,
        allowNull: true
      });
      console.log('✅ Columna facebookTokenExpiresAt agregada');

      // Agregar facebookPageCategory
      await queryInterface.addColumn(tableName, 'facebookPageCategory', {
        type: DataTypes.TEXT,
        allowNull: true
      });
      console.log('✅ Columna facebookPageCategory agregada');

      // Agregar facebookFanCount
      await queryInterface.addColumn(tableName, 'facebookFanCount', {
        type: DataTypes.INTEGER,
        allowNull: true
      });
      console.log('✅ Columna facebookFanCount agregada');

      // Agregar facebookPageLink
      await queryInterface.addColumn(tableName, 'facebookPageLink', {
        type: DataTypes.TEXT,
        allowNull: true
      });
      console.log('✅ Columna facebookPageLink agregada');

      // Agregar facebookWebhookEnabled
      await queryInterface.addColumn(tableName, 'facebookWebhookEnabled', {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      });
      console.log('✅ Columna facebookWebhookEnabled agregada');

      // Agregar facebookMetadata
      await queryInterface.addColumn(tableName, 'facebookMetadata', {
        type: DataTypes.JSONB,
        allowNull: true
      });
      console.log('✅ Columna facebookMetadata agregada');

      console.log('🎉 Todas las columnas de Facebook Messenger agregadas exitosamente');

    } catch (error) {
      console.error('❌ Error en migración:', error);
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    console.log('🔄 Revirtiendo campos de Facebook Messenger...');
    
    const tableName = 'Whatsapps';
    
    try {
      await queryInterface.removeColumn(tableName, 'facebookPageId');
      await queryInterface.removeColumn(tableName, 'facebookPageName');
      await queryInterface.removeColumn(tableName, 'facebookAccessToken');
      await queryInterface.removeColumn(tableName, 'facebookTokenExpiresAt');
      await queryInterface.removeColumn(tableName, 'facebookPageCategory');
      await queryInterface.removeColumn(tableName, 'facebookFanCount');
      await queryInterface.removeColumn(tableName, 'facebookPageLink');
      await queryInterface.removeColumn(tableName, 'facebookWebhookEnabled');
      await queryInterface.removeColumn(tableName, 'facebookMetadata');
      
      console.log('✅ Todas las columnas de Facebook Messenger removidas');
    } catch (error) {
      console.error('❌ Error revirtiendo migración:', error);
      throw error;
    }
  }
};