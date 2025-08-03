using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("it_customer")]
    public class ItCustomer
    {
         
        [Column("within_code")]
        public string within_code { get; set; } = string.Empty;
        
        [Key]
        [Column("id")]
        public string id { get; set; } = string.Empty;
        
        public string customerno { get; set; } = string.Empty;
        public string branchno { get; set; } = string.Empty;
        public string? customerref { get; set; }
        public string? customer_group { get; set; }
        public string? salesman { get; set; }
        public string? customername1 { get; set; }
        public string? customername2 { get; set; }
        public string? customername3 { get; set; }
        public string? customername4 { get; set; }
        public string? customername5 { get; set; }
        public string? customername6 { get; set; }
        public string? peaddress1 { get; set; }
        public string? peaddress2 { get; set; }
        public string? peaddress3 { get; set; }
        public string? seaddress1 { get; set; }
        public string? seaddress2 { get; set; }
        public string? seaddress3 { get; set; }
        public string? pcaddress1 { get; set; }
        public string? pcaddress2 { get; set; }
        public string? pcaddress3 { get; set; }
        public string? scaddress1 { get; set; }
        public string? scaddress2 { get; set; }
        public string? scaddress3 { get; set; }
        public string? ptelno { get; set; }
        public string? pfaxno { get; set; }
        public string? pmailaddr { get; set; }
        public string? stelno { get; set; }
        public string? sfaxno { get; set; }
        public string? smailaddr { get; set; }
        public string? busitype { get; set; }
        public string? mailaddr { get; set; }
        public string? district { get; set; }
        public string? is_vehicle { get; set; }
        public string? contactprn1e { get; set; }
        public string? contactprn1c { get; set; }
        public string? contactprn2e { get; set; }
        public string? contactprn2c { get; set; }
        public string? contacttel1 { get; set; }
        public string? contacttel2 { get; set; }
        public string? position1e { get; set; }
        public string? position1c { get; set; }
        public string? position2e { get; set; }
        public string? position2c { get; set; }
        public string? faxno1 { get; set; }
        public string? faxno2 { get; set; }
        public string? mailaddr1 { get; set; }
        public string? mailaddr2 { get; set; }
        public string? delivday1 { get; set; }
        public string? delivday2 { get; set; }
        public string? delivday3 { get; set; }
        public string? delivday4 { get; set; }
        public string? delivday5 { get; set; }
        public string? delivday6 { get; set; }
        public string? delivday7 { get; set; }
        public string? vehicle1 { get; set; }
        public string? vehicle2 { get; set; }
        public string? vehicle3 { get; set; }
        public string? vehicle4 { get; set; }
        public string? vehicle5 { get; set; }
        public string? vehicle6 { get; set; }
        public string? vehicle7 { get; set; }
        public string? timezone1 { get; set; }
        public string? timezone2 { get; set; }
        public string? timezone3 { get; set; }
        public string? timezone4 { get; set; }
        public string? timezone5 { get; set; }
        public string? timezone6 { get; set; }
        public string? timezone7 { get; set; }
        public string? delivord { get; set; }
        public decimal? copies { get; set; }
        public string? message1 { get; set; }
        public string? message2 { get; set; }
        public string? cod { get; set; }
        public decimal? creditage { get; set; }
        public decimal? creditlimt { get; set; }
        public decimal? tradedisc { get; set; }
        public decimal? tradedisc2 { get; set; }
        public decimal? paymtdisc { get; set; }
        public string? rebate { get; set; }
        public DateTime? valid_date { get; set; }
        public string? language { get; set; }
        public DateTime? firstsaledt { get; set; }
        public string? currency { get; set; }
        public string? state { get; set; }
        public string? transfers_state { get; set; }
        public string? update_count { get; set; }
        public DateTime? create_date { get; set; }
        public string? create_by { get; set; }
        public DateTime? update_date { get; set; }
        public string? update_by { get; set; }
        public string? parent_id { get; set; }
        public string? price_type { get; set; }
        public string? analysis_codes_1 { get; set; }
        public string? analysis_codes_2 { get; set; }
        public string? analysis_codes_3 { get; set; }
        public string? analysis_codes_4 { get; set; }
        public string? analysis_codes_5 { get; set; }
        public string? monthend_flag { get; set; }
        public decimal? monthend_discount { get; set; }
        public DateTime? evalidfrom { get; set; }
        public DateTime? evalidto { get; set; }
        public DateTime? validfrom { get; set; }
        public string? customer_group2 { get; set; }
        public string? customer_group3 { get; set; }
        public string? delivdayH { get; set; }
        public string? vehicleH { get; set; }
        public string? timezoneH { get; set; }
        public string? invoice_esp { get; set; }
        public string? customerno_bak { get; set; }
        public string? branchno_bak { get; set; }
        public string? vehicle1_s { get; set; }
        public string? vehicle2_s { get; set; }
        public string? vehicle3_s { get; set; }
        public string? vehicle4_s { get; set; }
        public string? vehicle5_s { get; set; }
        public string? vehicle6_s { get; set; }
        public string? vehicle7_s { get; set; }
        public string? ext_state { get; set; }
        public string? title1 { get; set; }
        public string? title2 { get; set; }
        public string? bill_rule { get; set; }
        public string? check_min_order { get; set; }
        public string? min_order_by { get; set; }
        public decimal? min_order { get; set; }
        public decimal? delivery_charges { get; set; }
        public string? location_consignment { get; set; }
        public string? carton_code_consignment { get; set; }
        public string? location_preset { get; set; }
        public string? carton_code_preset { get; set; }
        public decimal? min_delivery_amount { get; set; }
        public string? chk_credit { get; set; }
        public string? monthend_discount_email { get; set; }
        public string? statement_email { get; set; }
    }
} 