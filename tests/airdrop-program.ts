import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { AirdropProgram } from "../target/types/airdrop_program";
import { Keypair, SystemProgram, PublicKey } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } from "@solana/spl-token"
import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
use(chaiAsPromised);

describe("airdrop-program", async () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.AnchorProvider.env();
  const program = anchor.workspace.AirdropProgram as Program<AirdropProgram>;

  // derive PDA of the token mint and mint authority using our seeds 
  let tokenMint = PublicKey.findProgramAddressSync([Buffer.from("token-mint")], program.programId);
  const mintAuthority = PublicKey.findProgramAddressSync([Buffer.from("mint-authority")], program.programId);
  const stakingAuthority = PublicKey.findProgramAddressSync([Buffer.from("staking-authority")], program.programId);
  console.log("Token mint pda: ", tokenMint[0].toBase58());
	console.log("Mint auth pda: ", mintAuthority[0].toBase58());
	console.log("Staking auth pda: ", stakingAuthority[0].toBase58());

  const stakingVault = await getAssociatedTokenAddress(tokenMint[0], stakingAuthority[0], true);
  console.log("Staking vault: ", stakingVault.toBase58());

  const userTokenAccount = await getAssociatedTokenAddress(tokenMint[0], provider.wallet.publicKey);
  console.log("User ata: ", userTokenAccount.toBase58());

  const userStake = PublicKey.findProgramAddressSync([provider.wallet.publicKey.toBuffer(), Buffer.from("state_account")], program.programId);
  console.log("User stake pda: ", userStake[0].toBase58());

  it("Create Mint", async () => {
    const tx = await program.methods.initializeMint(10)
    .accounts({
      tokenMint: tokenMint[0],
      mintAuthority: mintAuthority[0],
      payer: provider.wallet.publicKey,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      stakingAuthority: stakingAuthority[0],
      stakingTokenAccount: stakingVault,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    })
    .signers([])
    .rpc()
    console.log("Initialize mint tx:", tx);
  })

  it("Airdrop tokens", async () => {
    const tx = await program.methods.airdrop(new anchor.BN(12))
    .accounts({
      tokenMint: tokenMint[0],
      mintAuthority: mintAuthority[0],
      user: provider.wallet.publicKey,
      userTokenAccount: userTokenAccount,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    })
    .rpc()
    console.log("Airdrop tx:", tx)

    let account = await getAccount(provider.connection, userTokenAccount);
    expect(account.amount).to.eql(BigInt(12));
  })

  it("Airdropping more tokens", async () => {
    const tx = await program.methods.airdrop(new anchor.BN(25))
    .accounts({
      tokenMint: tokenMint[0],
      mintAuthority: mintAuthority[0],
      user: provider.wallet.publicKey,
      userTokenAccount: userTokenAccount,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    })
    .rpc()
    console.log("Airdrop tx:", tx)

    let account = await getAccount(provider.connection, userTokenAccount);
    expect(account.amount).to.eql(BigInt(12+25));
  })

  it("Staking tokens", async () => {
    const tx = await program.methods.stake(new anchor.BN(25))
    .accounts({
      tokenMint: tokenMint[0],
      stakingAuthority: stakingAuthority[0],
      stakingTokenAccount: stakingVault,
      user: provider.wallet.publicKey,
      userTokenAccount: userTokenAccount,
      userStake: userStake[0],
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    })
    .rpc()
    console.log("Staking tx:", tx)

    let account = await getAccount(provider.connection, userTokenAccount);
    expect(account.amount).to.eql(BigInt(12));

    account = await getAccount(provider.connection, stakingVault);
    expect(account.amount).to.eql(BigInt(25));

    let stake = await program.account.stake.fetch(userStake[0]);
    expect(stake.amount.toNumber()).to.eql(25);
  })

  it("Staking too many tokens", async () => {
    await expect(program.methods.stake(new anchor.BN(13))
      .accounts({
        tokenMint: tokenMint[0],
        stakingAuthority: stakingAuthority[0],
        stakingTokenAccount: stakingVault,
        user: provider.wallet.publicKey,
        userTokenAccount: userTokenAccount,
        userStake: userStake[0],
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
      })
      .rpc()).to.be.rejected;

    let account = await getAccount(provider.connection, userTokenAccount);
    expect(account.amount).to.eql(BigInt(12));

    account = await getAccount(provider.connection, stakingVault);
    expect(account.amount).to.eql(BigInt(25));

    let stake = await program.account.stake.fetch(userStake[0]);
    expect(stake.amount.toNumber()).to.eql(25);
  })

  it("Staking remaining tokens", async () => {
    const tx = await program.methods.stake(new anchor.BN(12))
    .accounts({
      tokenMint: tokenMint[0],
      stakingAuthority: stakingAuthority[0],
      stakingTokenAccount: stakingVault,
      user: provider.wallet.publicKey,
      userTokenAccount: userTokenAccount,
      userStake: userStake[0],
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    })
    .rpc()
    console.log("Staking tx:", tx)

    let account = await getAccount(provider.connection, userTokenAccount);
    expect(account.amount).to.eql(BigInt(0));

    account = await getAccount(provider.connection, stakingVault);
    expect(account.amount).to.eql(BigInt(25 + 12));

    let stake = await program.account.stake.fetch(userStake[0]);
    expect(stake.amount.toNumber()).to.eql(25 + 12);
  })

  it("Unstaking tokens", async () => {
    const tx = await program.methods.unstake(new anchor.BN(25))
    .accounts({
      tokenMint: tokenMint[0],
      stakingAuthority: stakingAuthority[0],
      stakingTokenAccount: stakingVault,
      user: provider.wallet.publicKey,
      userTokenAccount: userTokenAccount,
      userStake: userStake[0],
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    })
    .rpc()
    console.log("Unstaking tx:", tx)

    let account = await getAccount(provider.connection, userTokenAccount);
    expect(account.amount).to.eql(BigInt(25));

    account = await getAccount(provider.connection, stakingVault);
    expect(account.amount).to.eql(BigInt(12));

    let stake = await program.account.stake.fetch(userStake[0]);
    expect(stake.amount.toNumber()).to.eql(12);
  })

  it("Unstaking too many tokens", async () => {
    await expect(program.methods.unstake(new anchor.BN(13))
      .accounts({
        tokenMint: tokenMint[0],
        stakingAuthority: stakingAuthority[0],
        stakingTokenAccount: stakingVault,
        user: provider.wallet.publicKey,
        userTokenAccount: userTokenAccount,
        userStake: userStake[0],
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
      })
      .rpc()).to.be.rejected;

      let account = await getAccount(provider.connection, userTokenAccount);
      expect(account.amount).to.eql(BigInt(25));
  
      account = await getAccount(provider.connection, stakingVault);
      expect(account.amount).to.eql(BigInt(12));
  
      let stake = await program.account.stake.fetch(userStake[0]);
      expect(stake.amount.toNumber()).to.eql(12);
  })

  it("Unstaking remaining tokens", async () => {
    const tx = await program.methods.unstake(new anchor.BN(12))
    .accounts({
      tokenMint: tokenMint[0],
      stakingAuthority: stakingAuthority[0],
      stakingTokenAccount: stakingVault,
      user: provider.wallet.publicKey,
      userTokenAccount: userTokenAccount,
      userStake: userStake[0],
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    })
    .rpc()
    console.log("Unstaking tx:", tx)

    let account = await getAccount(provider.connection, userTokenAccount);
    expect(account.amount).to.eql(BigInt(25+12));

    account = await getAccount(provider.connection, stakingVault);
    expect(account.amount).to.eql(BigInt(0));

    let stake = await program.account.stake.fetch(userStake[0]);
    expect(stake.amount.toNumber()).to.eql(0);
  })
})
