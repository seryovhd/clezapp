import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    console.log('🔄 Cambiando mediaUrl de VARCHAR a TEXT...');
    
    try {
      await queryInterface.changeColumn('Messages', 'mediaUrl', {
        type: DataTypes.TEXT,
        allowNull: true
      });
      
      console.log('✅ mediaUrl cambiado a TEXT exitosamente');
    } catch (error) {
      console.error('❌ Error en migración mediaUrl:', error);
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    console.log('🔄 Revirtiendo mediaUrl a VARCHAR...');
    
    try {
      await queryInterface.changeColumn('Messages', 'mediaUrl', {
        type: DataTypes.STRING(255),
        allowNull: true
      });
      
      console.log('✅ mediaUrl revertido a VARCHAR exitosamente');
    } catch (error) {
      console.error('❌ Error revirtiendo migración mediaUrl:', error);
      throw error;
    }
  }
};