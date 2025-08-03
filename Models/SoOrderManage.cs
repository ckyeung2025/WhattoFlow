using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("so_order_manage")]
    public class SoOrderManage
    {
        [Key]
        [Column("id")]
        public string id { get; set; } = string.Empty;
        
        [Column("within_code")]
        public string within_code { get; set; } = string.Empty;
        
        public string orderno { get; set; } = string.Empty;
        public DateTime? orderdate { get; set; }
        public string? invoiceno { get; set; }
        public DateTime? invdate { get; set; }
        public string? customerno { get; set; }
        public string? branch { get; set; }
        public string? etradname { get; set; }
        public string? ctradname { get; set; }
        public string? ename { get; set; }
        public string? cname { get; set; }
        public string? addr1 { get; set; }
        public string? addr2 { get; set; }
        public string? addr3 { get; set; }
        public string? tel { get; set; }
        public string? cod { get; set; }
        public string? salesman { get; set; }
        public string? vehicle { get; set; }
        public string? vehicle_seq { get; set; }
        public string? remark1 { get; set; }
        public string? remark2 { get; set; }
        public string? remark3 { get; set; }
        public decimal? ctlunitqty { get; set; }
        public decimal? ctlinqty { get; set; }
        public decimal? ctlbpackqty { get; set; }
        public decimal? invdisc { get; set; }
        public decimal? invdisc2 { get; set; }
        public decimal? totweight { get; set; }
        public decimal? invamt { get; set; }
        public string? status { get; set; }
        public string? statcode { get; set; }
        public string? back_remark { get; set; }
        public int? editstat { get; set; }
        public string? postflag { get; set; }
        public string? cfmflag { get; set; }
        public int? serialno { get; set; }
        public string? managerid { get; set; }
        public string? currency { get; set; }
        public string? origin_id { get; set; }
        public string? update_count { get; set; }
        public decimal? print_count { get; set; }
        public string? state { get; set; }
        public DateTime? create_date { get; set; }
        public string? create_by { get; set; }
        public DateTime? update_date { get; set; }
        public string? update_by { get; set; }
        public string? check_by { get; set; }
        public DateTime? check_date { get; set; }
        public string? status_tmp { get; set; }
        public string? delivday { get; set; }
        public string? excel_flag { get; set; }
        public string? excel_remark { get; set; }
        public string? ext_state { get; set; }
        public string? vatno { get; set; }
        public DateTime? vatdate { get; set; }
        public string? is_vat { get; set; }
        public string? edi_inv { get; set; }
        public string? edi_asn { get; set; }
        public string? maxim_gln { get; set; }
        public string? maxim_gln_location { get; set; }
        public string? tmp_id { get; set; }
        public string? or_vehicle { get; set; }
        public string? pdf_postflag { get; set; }
        public DateTime? pdf_import_date { get; set; }
        public string? pdf_path { get; set; }
    }
} 