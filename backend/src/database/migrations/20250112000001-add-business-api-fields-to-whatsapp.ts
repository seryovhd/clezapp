import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    console.log('🔄 Agregando campos de Business API a Whatsapp...');
    
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
      
      if (!tableInfo.businessAccountId) {
        await queryInterface.addColumn(tableName, 'businessAccountId', {
          type: DataTypes.TEXT,
          allowNull: true
        });
        console.log('✅ Columna businessAccountId agregada');
      }
      
      if (!tableInfo.phoneNumberId) {
        await queryInterface.addColumn(tableName, 'phoneNumberId', {
          type: DataTypes.TEXT,
          allowNull: true
        });
        console.log('✅ Columna phoneNumberId agregada');
      }
      
      if (!tableInfo.wabaId) {
        await queryInterface.addColumn(tableName, 'wabaId', {
          type: DataTypes.TEXT,
          allowNull: true
        });
        console.log('✅ Columna wabaId agregada');
      }
      
      if (!tableInfo.businessAccessToken) {
        await queryInterface.addColumn(tableName, 'businessAccessToken', {
          type: DataTypes.TEXT,
          allowNull: true
        });
        console.log('✅ Columna businessAccessToken agregada');
      }
      
      if (!tableInfo.businessTokenExpiresAt) {
        await queryInterface.addColumn(tableName, 'businessTokenExpiresAt', {
          type: DataTypes.DATE,
          allowNull: true
        });
        console.log('✅ Columna businessTokenExpiresAt agregada');
      }
      
      if (!tableInfo.businessName) {
        await queryInterface.addColumn(tableName, 'businessName', {
          type: DataTypes.TEXT,
          allowNull: true
        });
        console.log('✅ Columna businessName agregada');
      }
      
      if (!tableInfo.businessVerificationStatus) {
        await queryInterface.addColumn(tableName, 'businessVerificationStatus', {
          type: DataTypes.TEXT,
          allowNull: true
        });
        console.log('✅ Columna businessVerificationStatus agregada');
      }
      
      if (!tableInfo.webhookVerifyToken) {
        await queryInterface.addColumn(tableName, 'webhookVerifyToken', {
          type: DataTypes.TEXT,
          allowNull: true
        });
        console.log('✅ Columna webhookVerifyToken agregada');
      }
      
      if (!tableInfo.webhookUrl) {
        await queryInterface.addColumn(tableName, 'webhookUrl', {
          type: DataTypes.TEXT,
          allowNull: true
        });
        console.log('✅ Columna webhookUrl agregada');
      }
      
      if (!tableInfo.webhookEnabled) {
        await queryInterface.addColumn(tableName, 'webhookEnabled', {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: true
        });
        console.log('✅ Columna webhookEnabled agregada');
      }
      
      if (!tableInfo.businessMetadata) {
        await queryInterface.addColumn(tableName, 'businessMetadata', {
          type: DataTypes.JSONB,
          allowNull: true
        });
        console.log('✅ Columna businessMetadata agregada');
      }
      
      console.log('🎉 Todas las columnas de Business API agregadas exitosamente');
      
    } catch (error) {
      console.error('❌ Error en migración:', error);
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    console.log('🔄 Revirtiendo campos de Business API...');
    
    const tableName = 'Whatsapps';
    
    try {
      await queryInterface.removeColumn(tableName, 'businessAccountId');
      await queryInterface.removeColumn(tableName, 'phoneNumberId');
      await queryInterface.removeColumn(tableName, 'wabaId');
      await queryInterface.removeColumn(tableName, 'businessAccessToken');
      await queryInterface.removeColumn(tableName, 'businessTokenExpiresAt');
      await queryInterface.removeColumn(tableName, 'businessName');
      await queryInterface.removeColumn(tableName, 'businessVerificationStatus');
      await queryInterface.removeColumn(tableName, 'webhookVerifyToken');
      await queryInterface.removeColumn(tableName, 'webhookUrl');
      await queryInterface.removeColumn(tableName, 'webhookEnabled');
      await queryInterface.removeColumn(tableName, 'businessMetadata');
      console.log('✅ Todas las columnas de Business API removidas');
    } catch (error) {
      console.error('❌ Error revirtiendo migración:', error);
      throw error;
    }
  }
};

