using Microsoft.EntityFrameworkCore;
using PurpleRice.Models;

namespace PurpleRice.Data
{
    public class ErpDbContext : DbContext
    {
        public ErpDbContext(DbContextOptions<ErpDbContext> options) : base(options) { }

        public DbSet<SoOrderManage> SoOrderManage { get; set; }
        public DbSet<ItCustomer> ItCustomer { get; set; }
        public DbSet<SysUser> SysUser { get; set; }
        public DbSet<so_order_details> SoOrderDetails { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<SoOrderManage>().ToTable("so_order_manage", schema: "dbo");
            modelBuilder.Entity<ItCustomer>().ToTable("it_customer", schema: "dbo");
            modelBuilder.Entity<SysUser>().ToTable("sys_user", schema: "dbo");
            modelBuilder.Entity<so_order_details>()
                .HasKey(e => new { e.within_code, e.id, e.sequence_id });
            modelBuilder.Entity<so_order_details>().ToTable("so_order_details", schema: "dbo");
        }
    }
} 